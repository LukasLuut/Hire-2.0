import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";
import { Service } from "../models/Service";
import { ServiceLike } from "../models/ServiceLike";
import { statsService } from "./StatsService";

interface ServiceInterface {
  title: string;
  description_service: string;
  negotiable: boolean;
  requiresScheduling: boolean;
  duration: string;
  subcategory: string;  
  price: number;
  providerId: string;
  categoryId: string;
}

export class ServiceService {
  private serviceRepository = AppDataSource.getRepository(Service);
  private hireRepository = AppDataSource.getRepository(Hire);
  private likeRepository = AppDataSource.getRepository(ServiceLike);

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

  async create(data: ServiceInterface, file?: Express.Multer.File) {
    const {
      title,
      description_service,
      negotiable,
      requiresScheduling,
      duration,
      subcategory,
      providerId,
      categoryId,
      price,
    } = data;

    const imageUrl = file ? `/uploads/${file.filename}` : null;

    const service = this.serviceRepository.create({
      title,
      description_service,
      negotiable,
      requiresScheduling,
      duration,
      price,
      imageUrl,
      subcategory,
      provider: { id: Number(providerId) },
      category: { id: Number(categoryId) },
    });

    return await this.serviceRepository.save(service);
  }

  async list() {
    const services = await this.serviceRepository.find({ relations: { category: true, provider: true }, order: { id: "DESC" } });
    return this.withStats(services);
  }

  async getById(id: number) {
    const service = await this.serviceRepository.findOne({ where: { id: id }, relations: { category: true, provider: true }});
    if (!service) throw new Error("Serviço não encontrado");
    return (await this.withStats([service]))[0];
  }

  async update(id: number, data: Partial<Service> & { categoryId?: string | number }, file?: Express.Multer.File) {
  const service = await this.serviceRepository.findOne({
    where: { id },
  });

  if (!service) {
    throw new Error('Serviço não encontrado');
  }

  // Campos de formulário que não são colunas do serviço
  const { categoryId, provider: _provider, category: _category, ...rest } = data as any;
  delete rest.providerId;
  delete rest.image;

  if (file) {
    rest.imageUrl = `/uploads/${file.filename}`;
  }
  if (rest.price !== undefined) rest.price = Number(rest.price);

  Object.assign(service, rest);
  if (categoryId) service.category = { id: Number(categoryId) } as any;
  return await this.serviceRepository.save(service);
}


  async remove(id: number) {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) throw new Error("Serviço não encontrado");

    const hire = await this.hireRepository.findOne({ where: [
      { status: StatusEnum.EM_ANDAMENTO, service: { id: id } },
      { status: StatusEnum.PENDENTE, service: { id: id } },
    ]});
    if(hire) throw new Error("Esse serviço não pode ter nenhuma contratação em andamento");

    await this.serviceRepository.remove(service);

    return { message: "Serviço removido com sucesso" };
  }
}
