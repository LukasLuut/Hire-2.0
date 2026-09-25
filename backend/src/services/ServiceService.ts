import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";
import { Service } from "../models/Service";
import { ServiceLike } from "../models/ServiceLike";
import { ServiceProvider } from "../models/ServiceProvider";
import { statsService } from "./StatsService";
import { HttpError } from "./HireService";
import { parseSlots } from "../utils/schedule";

export interface ServiceInput {
  title: string;
  description_service: string;
  negotiable: boolean;
  requiresScheduling: boolean;
  duration: string;
  subcategory?: string;
  price: number | string;
  categoryId: string | number;
  scheduleSlots?: unknown;
  cancellationNotice?: string;
  active?: boolean;
}

export class ServiceService {
  private serviceRepository = AppDataSource.getRepository(Service);
  private hireRepository = AppDataSource.getRepository(Hire);
  private likeRepository = AppDataSource.getRepository(ServiceLike);
  private providerRepository = AppDataSource.getRepository(ServiceProvider);

  /** Perfil de prestador do usuário logado — só ele publica e edita os próprios serviços. */
  private async providerOf(userId: number) {
    const provider = await this.providerRepository.findOne({ where: { user: { id: userId } } });
    if (!provider) throw new HttpError(403, "Cadastre sua empresa antes de publicar serviços");
    return provider;
  }

  private async ownedService(id: number, userId: number) {
    const service = await this.serviceRepository.findOne({ where: { id }, relations: { provider: { user: true } } });
    if (!service) throw new HttpError(404, "Serviço não encontrado");
    if (service.provider?.user?.id !== userId) throw new HttpError(403, "Você só pode alterar os seus próprios serviços");
    return service;
  }

  /**
   * Monta a lista de imagens: as já publicadas que o prestador manteve (na ordem enviada)
   * seguidas dos arquivos novos. A primeira vira a capa.
   */
  private buildImages(keep: unknown, files: Express.Multer.File[], current: string[]) {
    let kept: string[] = current;
    if (keep !== undefined) {
      try {
        const parsed = typeof keep === "string" ? JSON.parse(keep) : keep;
        kept = Array.isArray(parsed) ? parsed.map(String).filter((u) => current.includes(u)) : current;
      } catch {
        kept = current;
      }
    }
    return [...kept, ...files.map((f) => `/uploads/${f.filename}`)].slice(0, 8);
  }


  /** Acrescenta a nota do serviço e a nota do prestador (avaliações reais). */
  async withStats(services: Service[]) {
    const [serviceStats, providerStats] = await Promise.all([
      statsService.forServices(services.map((s) => s.id)),
      statsService.forProviders([...new Set(services.map((s) => s.provider?.id).filter(Boolean) as number[])]),
    ]);
    return services.map((s) => ({
      ...s,
      rating: serviceStats.get(s.id) ?? { average: 0, count: 0 },
      provider: s.provider
        ? { ...s.provider, rating: providerStats.get(s.provider.id) ?? { average: 0, count: 0 } }
        : s.provider,
    }));
  }

  /** Curte ou descurte um serviço; mantém a coluna likesNumber sincronizada. */
  async toggleLike(serviceId: number, userId: number) {
    const service = await this.serviceRepository.findOne({ where: { id: serviceId } });
    if (!service) throw new Error("Serviço não encontrado");
    const existing = await this.likeRepository.findOne({ where: { service: { id: serviceId }, user: { id: userId } } });
    if (existing) await this.likeRepository.remove(existing);
    else await this.likeRepository.save(this.likeRepository.create({ service: { id: serviceId }, user: { id: userId } }));
    const likesNumber = await this.likeRepository.count({ where: { service: { id: serviceId } } });
    await this.serviceRepository.update(serviceId, { likesNumber });
    return { liked: !existing, likesNumber };
  }

  /** IDs dos serviços que o usuário curtiu. */
  async likedBy(userId: number) {
    const likes = await this.likeRepository.find({ where: { user: { id: userId } }, relations: { service: true } });
    return likes.map((l) => l.service.id);
  }

  async create(data: ServiceInput, userId: number, files: Express.Multer.File[] = []) {
    const provider = await this.providerOf(userId);
    const price = Number(data.price);
    if (!data.title?.trim() || !data.description_service?.trim()) throw new HttpError(400, "Informe título e descrição do serviço");
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Informe um preço válido");
    if (!data.categoryId) throw new HttpError(400, "Escolha uma categoria");

    const images = this.buildImages(undefined, files, []);
    const scheduleSlots = parseSlots(data.scheduleSlots);
    if (data.requiresScheduling && !scheduleSlots) throw new HttpError(400, "Escolha ao menos um horário na agenda do serviço");

    const service = this.serviceRepository.create({
      title: data.title.trim(),
      description_service: data.description_service.trim(),
      negotiable: data.negotiable,
      requiresScheduling: data.requiresScheduling,
      duration: data.duration?.trim() || "A combinar",
      price,
      subcategory: data.subcategory?.trim() || undefined,
      imageUrl: images[0] ?? null,
      images,
      scheduleSlots: data.requiresScheduling ? scheduleSlots : null,
      cancellationNotice: data.requiresScheduling ? data.cancellationNotice?.trim() || null : null,
      provider: { id: provider.id },
      category: { id: Number(data.categoryId) },
    });

    return await this.serviceRepository.save(service);
  }

  /** Vitrine: só serviços ativos (pausados continuam acessíveis pelo id). */
  async list() {
    const services = await this.serviceRepository.find({ where: { active: true }, relations: { category: true, provider: true }, order: { id: "DESC" } });
    return this.withStats(services);
  }

  async getById(id: number) {
    const service = await this.serviceRepository.findOne({ where: { id: id }, relations: { category: true, provider: true }});
    if (!service) throw new Error("Serviço não encontrado");
    return (await this.withStats([service]))[0];
  }

  async update(id: number, data: Partial<ServiceInput> & { keepImages?: unknown }, userId: number, files: Express.Multer.File[] = []) {
    const service = await this.ownedService(id, userId);

    if (data.title !== undefined) service.title = String(data.title).trim();
    if (data.description_service !== undefined) service.description_service = String(data.description_service).trim();
    if (data.duration !== undefined) service.duration = String(data.duration).trim() || "A combinar";
    if (data.subcategory !== undefined) service.subcategory = String(data.subcategory).trim() || undefined;
    if (data.negotiable !== undefined) service.negotiable = data.negotiable;
    if (data.requiresScheduling !== undefined) service.requiresScheduling = data.requiresScheduling;
    if (data.active !== undefined) service.active = data.active;
    if (data.price !== undefined) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Informe um preço válido");
      service.price = price;
    }
    if (data.categoryId) service.category = { id: Number(data.categoryId) } as any;
    if (data.scheduleSlots !== undefined) service.scheduleSlots = parseSlots(data.scheduleSlots);
    if (data.cancellationNotice !== undefined) service.cancellationNotice = String(data.cancellationNotice).trim() || null;
    if (!service.requiresScheduling) {
      service.scheduleSlots = null;
      service.cancellationNotice = null;
    } else if (!service.scheduleSlots) {
      throw new HttpError(400, "Escolha ao menos um horário na agenda do serviço");
    }

    if (files.length || data.keepImages !== undefined) {
      const current = service.images?.length ? service.images : service.imageUrl ? [service.imageUrl] : [];
      service.images = this.buildImages(data.keepImages, files, current);
      service.imageUrl = service.images[0] ?? null;
    }

    const { provider: _p, ...saved } = await this.serviceRepository.save(service);
    return saved;
  }

  async remove(id: number, userId: number) {
    const service = await this.ownedService(id, userId);

    const hire = await this.hireRepository.findOne({ where: [
      { status: StatusEnum.EM_ANDAMENTO, service: { id: id } },
      { status: StatusEnum.PENDENTE, service: { id: id } },
    ]});
    if(hire) throw new HttpError(400, "Esse serviço não pode ter nenhuma contratação em andamento");

    await this.serviceRepository.remove(service);

    return { message: "Serviço removido com sucesso" };
  }
}
