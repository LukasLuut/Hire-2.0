import { AppDataSource } from "../config/data-source";
import { portfolioService } from "./PortfolioService";
import { IsNull } from "typeorm";
import { isSlug, uniqueSlug } from "../utils/slug";
import { toPublicProvider } from "../utils/publicProvider";
import { ServiceProvider } from "../models/ServiceProvider";
import { coord } from "../utils/geo";
import { User } from "../models/User";
import { Subcategory } from "../models/Subcategory";
import { Availability } from "../models/Availability";
import { Link } from "../models/Link";
import { StatsService, statsService } from "./StatsService";
import { ServiceService } from "./ServiceService";

const serviceService = new ServiceService();

// Dados públicos do prestador: nunca expõe e-mail, CPF ou senha do usuário dono do perfil
export class ProviderService {
  private providerRepository = AppDataSource.getRepository(ServiceProvider);
  private userRepository = AppDataSource.getRepository(User);
  private subcategoryRepository = AppDataSource.getRepository(Subcategory);
  private linkRepository = AppDataSource.getRepository(Link);
  private availabilityRepository = AppDataSource.getRepository(Availability);

  async create(
    idUser: number,
    data: {
      companyName: string;
      categoryId?: string;
      subcategories?: string;
      links?: string;
      availabilities?: {
        day?: {
          start?: string,
          end?: string
        }
      };
    },
    file?: Express.Multer.File
  ) {
    const profileImageUrl = file ? `/uploads/${file.filename}` : null;

    const user = await this.userRepository.findOne({
      where: { id: idUser },
      relations: { provider: true },
    });
    if (!user) throw new Error("Usuário não existente");
    if (user.provider) throw new Error("Prestador de serviços já existente");

    // Valida os campos em JSON antes de salvar, para não deixar um prestador incompleto no banco
    const subcategories = parseJsonList(data.subcategories);
    const links = parseJsonList(data.links);

    const newData: any = {
      ...editableFields(data),
      ...areaFields(data),
      user,
      profileImageUrl,
      category: data.categoryId ? { id: Number(data.categoryId) } : null,
    };

    newData.slug = await this.newSlug(newData.companyName || newData.professionalName);
    const providerSaved = await this.providerRepository.save(
      this.providerRepository.create(newData)
    ) as unknown as ServiceProvider;

    await this.saveRelations(providerSaved, { subcategories, links, availabilities: data.availabilities });
    await this.syncEmailPreference(user.id, (data as any).emailNotification);

    return providerSaved;
  }

  /** Slug único para um nome (ver utils/slug.ts) */
  private newSlug(name: unknown, ignoreId?: number) {
    return uniqueSlug(name, async (candidate) => {
      const found = await this.providerRepository.findOne({ where: { slug: candidate }, select: { id: true } });
      return !!found && found.id !== ignoreId;
    });
  }

  /** Prestadores antigos sem slug ganham um (roda ao subir o servidor) */
  async ensureSlugs() {
    const missing = await this.providerRepository.find({ where: { slug: IsNull() } });
    for (const p of missing) {
      p.slug = await this.newSlug(p.companyName || p.professionalName, p.id);
      await this.providerRepository.update(p.id, { slug: p.slug });
    }
    return missing.length;
  }

  /** Slug do prestador (gera se ainda não tiver) */
  async slugOf(id: number) {
    const p = await this.providerRepository.findOne({ where: { id }, select: { id: true, slug: true, companyName: true, professionalName: true } });
    if (!p) throw new Error("Prestador não encontrado");
    if (p.slug) return p.slug;
    const slug = await this.newSlug(p.companyName || p.professionalName, p.id);
    await this.providerRepository.update(p.id, { slug });
    return slug;
  }

  /** "12" → id; "souza-eletrica" → slug; qualquer outra coisa é inválida */
  async resolveId(idOrSlug: string) {
    if (/^\d+$/.test(idOrSlug)) return Number(idOrSlug);
    if (!isSlug(idOrSlug)) throw new Error("Prestador não encontrado");
    const found = await this.providerRepository.findOne({ where: { slug: idOrSlug }, select: { id: true } });
    if (!found) throw new Error("Prestador não encontrado");
    return found.id;
  }

  /** A opção "avisos por e-mail" do cadastro vale para a conta inteira. */
  private async syncEmailPreference(userId: number, value: unknown) {
    if (value === undefined) return;
    const on = value === true || value === "true";
    await this.userRepository.update(userId, { emailNotifications: on });
  }

  // Grava subcategorias, links e disponibilidade; com replace, apaga os anteriores antes
  private async saveRelations(
    provider: ServiceProvider,
    rel: { subcategories?: string[]; links?: string[]; availabilities?: Record<string, any> | null },
    replace = false
  ) {
    if (rel.subcategories) {
      if (replace) await this.subcategoryRepository.delete({ provider: { id: provider.id } });
      if (rel.subcategories.length > 0) {
        await this.subcategoryRepository.save(
          rel.subcategories.map((name) => this.subcategoryRepository.create({ name, provider }))
        );
      }
    }

    if (rel.links) {
      if (replace) await this.linkRepository.delete({ provider: { id: provider.id } });
      if (rel.links.length > 0) {
        await this.linkRepository.save(rel.links.map((name) => this.linkRepository.create({ name, provider })));
      }
    }

    if (rel.availabilities) {
      if (replace) await this.availabilityRepository.delete({ provider: { id: provider.id } });
      const availabilities = Object.entries(rel.availabilities)
        .filter(([, value]) => value != null)
        .map(([day, { start, end }]) => this.availabilityRepository.create({ day, start, end, provider }));
      await this.availabilityRepository.save(availabilities);
    }
  }

  async getById(id: number) {
    const provider = await this.providerRepository.findOne({
      relations: {
        user: true,
        subcategories: true,
        links: true,
        category: true,
        availabilities: true,
      },
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Prestador não encontrado");

    return (await this.decorate([provider]))[0];
  }

  /** Nota média, total de avaliações, serviços concluídos e nível. */
  private async decorate<T extends ServiceProvider>(providers: T[]) {
    const ids = providers.map((p) => p.id);
    const [ratings, completed, late] = await Promise.all([statsService.forProviders(ids), statsService.completedHires(ids), statsService.lateCancellations(ids)]);
    return providers.map((p) => {
      const done = completed.get(p.id) ?? 0;
      return { ...p, rating: ratings.get(p.id) ?? StatsService.empty(), completedHires: done, level: StatsService.level(done), lateCancellations: late.get(p.id) ?? 0 };
    });
  }

  /** Perfil público de um prestador (página "Ver perfil"). */
  async getPublic(providerId: number) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
      relations: { user: true, subcategories: true, links: true, category: true, availabilities: true, services: { category: true } },
    });
    if (!provider) throw new Error("Prestador não encontrado");
    const [decorated] = await this.decorate([provider]);
    // perfil público mostra só os serviços ativos
    const services = await serviceService.withStats(provider.services.filter((s) => s.active !== false).map((s) => ({ ...s, provider } as any)));
    // "No Hire desde": a data mais antiga entre o cadastro da conta (aceite dos termos) e o da empresa
    const dates = [provider.createdAt, provider.user?.acceptedAt].filter(Boolean).map((d) => new Date(d as any).getTime());
    const memberSince = dates.length ? new Date(Math.min(...dates)) : null;
    const portfolio = await portfolioService.list(provider.id);
    const pub = { ...(toPublicProvider({ ...decorated, user: provider.user, emailVerified: !!provider.user?.emailVerified } as any) as any), memberSince, portfolio };
    return {
      ...pub,
      services: services.map((s: any) => ({ ...s, provider: { id: provider.id, slug: pub.slug, companyName: provider.companyName, professionalName: provider.professionalName, profileImageUrl: provider.profileImageUrl, description: provider.description, rating: decorated.rating, pricesOnPage: provider.pricesOnPage, verificationStatus: provider.verificationStatus } })),
    };
  }

  async getServices(id: number) {
    const provider = await this.providerRepository.findOne({
      relations: {
        services: {
          category: true,
        },
      },
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Prestador não encontrado");

    return serviceService.withStats(provider.services.map((s) => ({ ...s, provider } as any)));
  }

  async remove(id: number) {
    const provider = await this.providerRepository.findOne({
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Provedor não encontrado");

    await this.providerRepository.remove(provider);
    return { message: "Provedor removido" };
  }

  /** Todos os prestadores com nota, ordenados pelos mais bem avaliados. */
  async list() {
    const providers = await this.providerRepository.find({ relations: { user: true, category: true, subcategories: true } });
    const decorated = await this.decorate(providers);
    return decorated
      .map((p) => toPublicProvider(p as any) as any)
      .sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count || b.completedHires - a.completedHires);
  }

  async update(id: number, data: any, file?: Express.Multer.File) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: id } },
      relations: { user: true },
    });
    if (!provider) throw new Error("Prestador não encontrado");

    // Listas podem chegar como JSON (multipart) ou já como arrays/objetos (JSON)
    const subcategories = data.subcategories === undefined ? undefined
      : Array.isArray(data.subcategories) ? data.subcategories : parseJsonList(data.subcategories);
    const links = data.links === undefined ? undefined
      : Array.isArray(data.links) ? data.links : parseJsonList(data.links);
    const availabilities = typeof data.availabilities === "string"
      ? JSON.parse(data.availabilities || "null")
      : data.availabilities;

    const { categoryId } = data;

    // só os campos do formulário; verificação, dono, datas e contagens não vêm do cliente
    const previousCnpj = (provider.cnpj ?? "").replace(/\D/g, "");
    Object.assign(provider, editableFields(data), areaFields(data));
    // CNPJ trocado: a empresa conferida antes deixa de valer
    if ((provider.cnpj ?? "").replace(/\D/g, "") !== previousCnpj) provider.companyVerifiedAt = null;
    if (categoryId) provider.category = { id: Number(categoryId) } as any;
    if (file) provider.profileImageUrl = `/uploads/${file.filename}`;

    const saved = await this.providerRepository.save(provider);
    await this.saveRelations(saved, { subcategories, links, availabilities }, true);
    await this.syncEmailPreference(id, data.emailNotification);

    return this.getById(id);
  }
}

/** Campos que o próprio prestador pode editar (lista fechada: evita atribuição em massa) */
const TEXT_FIELDS = ["companyName", "professionalName", "professionalEmail", "professionalPhone", "description", "cnpj", "onlineLink", "status"] as const;
const BOOL_FIELDS = ["attendsPresent", "attendsOnline", "personalizedProposals", "approximateLocation", "publicReviews", "pricesOnPage", "whatsNotification", "emailNotification", "showContact"] as const;

function editableFields(data: any) {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_FIELDS) if (data[k] !== undefined && data[k] !== null) out[k] = String(data[k]).trim();
  for (const k of BOOL_FIELDS) if (data[k] !== undefined) out[k] = data[k] === true || data[k] === "true";
  return out;
}

/** Campos da área de atendimento vindos do formulário (só os enviados, já validados). */
function areaFields(data: any) {
  const out: Record<string, unknown> = {};
  if (data.latitude !== undefined) out.latitude = coord(data.latitude, 90);
  if (data.longitude !== undefined) out.longitude = coord(data.longitude, 180);
  if (data.baseCity !== undefined) out.baseCity = String(data.baseCity).trim().slice(0, 80) || null;
  if (data.baseState !== undefined) out.baseState = String(data.baseState).trim().toUpperCase().slice(0, 2) || null;
  if (data.serviceRadiusKm !== undefined) {
    const r = Math.round(Number(data.serviceRadiusKm));
    out.serviceRadiusKm = Number.isFinite(r) ? Math.min(Math.max(r, 1), 300) : 20;
  }
  return out;
}

// Converte um campo de formulário (string JSON) em lista de strings; vazio ou inválido vira lista vazia
function parseJsonList(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string" && v.trim() !== "") : [];
  } catch {
    throw new Error("Formato inválido em subcategorias ou links");
  }
}
