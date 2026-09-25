import { Like } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { User } from "../models/User";
import { Service } from "../models/Service";
import { Hire, StatusEnum } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { HttpError } from "./HireService";
import { setBlocked } from "../utils/access";
import { notificationService } from "./NotificationService";

/* Operações do painel de administração (todas exigem adminMiddleware). */
export class AdminService {
  private users = AppDataSource.getRepository(User);
  private services = AppDataSource.getRepository(Service);
  private hires = AppDataSource.getRepository(Hire);
  private providers = AppDataSource.getRepository(ServiceProvider);

  /** Números gerais da plataforma */
  async overview() {
    const [users, blocked, providers, services, paused] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { blocked: true } }),
      this.providers.count(),
      this.services.count(),
      this.services.count({ where: { active: false } }),
    ]);
    const byStatus = await this.hires
      .createQueryBuilder("h")
      .select("h.status_provider", "status")
      .addSelect("COUNT(h.id)", "count")
      .groupBy("h.status_provider")
      .getRawMany();
    const lateCancels = await this.hires.count({ where: { lateCancel: true } });
    return {
      users,
      blocked,
      providers,
      services,
      pausedServices: paused,
      hires: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      lateCancels,
    };
  }

  /** Busca de usuários por nome ou e-mail (até 50) */
  async listUsers(q: string) {
    const term = q.trim();
    const where = term ? [{ name: Like(`%${term}%`) }, { email: Like(`%${term}%`) }] : {};
    const rows = await this.users.find({ where, relations: { provider: true }, order: { id: "DESC" }, take: 50 });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      blocked: u.blocked,
      blockedReason: u.blockedReason,
      emailVerified: u.emailVerified,
      provider: u.provider ? { id: u.provider.id, name: u.provider.companyName || u.provider.professionalName } : null,
    }));
  }

  /** Suspende ou reativa uma conta; contas suspensas não entram nem usam a API */
  async setBlocked(targetId: number, value: boolean, reason: unknown, adminId: number) {
    if (targetId === adminId) throw new HttpError(400, "Você não pode suspender a própria conta");
    const user = await this.users.findOne({ where: { id: targetId } });
    if (!user) throw new HttpError(404, "Usuário não encontrado");
    if (user.role === "admin" && value) throw new HttpError(400, "Remova o papel de administrador antes de suspender");
    user.blocked = value;
    user.blockedReason = value ? String(reason ?? "").trim().slice(0, 300) || null : null;
    await this.users.save(user);
    setBlocked(user.id, value);
    return { id: user.id, blocked: user.blocked, blockedReason: user.blockedReason };
  }

  /** Dá ou tira o papel de administrador */
  async setRole(targetId: number, role: unknown, adminId: number) {
    if (role !== "admin" && role !== "user") throw new HttpError(400, "Papel inválido");
    if (targetId === adminId && role === "user") throw new HttpError(400, "Você não pode remover o próprio acesso de administrador");
    const user = await this.users.findOne({ where: { id: targetId } });
    if (!user) throw new HttpError(404, "Usuário não encontrado");
    if (user.blocked && role === "admin") throw new HttpError(400, "Reative a conta antes de torná-la administradora");
    user.role = role;
    await this.users.save(user);
    return { id: user.id, role: user.role };
  }

  /** Busca de serviços por título (até 50), inclusive pausados */
  async listServices(q: string) {
    const term = q.trim();
    const rows = await this.services.find({
      where: term ? { title: Like(`%${term}%`) } : {},
      relations: { provider: { user: true }, category: true },
      order: { id: "DESC" },
      take: 50,
    });
    return rows.map((s) => ({
      id: s.id,
      title: s.title,
      price: s.price,
      active: s.active,
      category: s.category?.name ?? null,
      provider: s.provider ? { id: s.provider.id, name: s.provider.companyName || s.provider.professionalName, userId: s.provider.user?.id } : null,
    }));
  }

  /** Tira um serviço da vitrine (ou devolve), avisando o prestador */
  async setServiceActive(id: number, active: boolean, reason: unknown) {
    const service = await this.services.findOne({ where: { id }, relations: { provider: { user: true } } });
    if (!service) throw new HttpError(404, "Serviço não encontrado");
    service.active = active;
    await this.services.save(service);
    const why = String(reason ?? "").trim().slice(0, 300);
    await notificationService.notify(service.provider?.user?.id, {
      type: active ? "admin.service.restored" : "admin.service.paused",
      title: active ? `Serviço reativado: ${service.title}` : `Serviço pausado pela administração: ${service.title}`,
      body: active ? "Seu serviço voltou para a vitrine." : `O serviço saiu da vitrine.${why ? ` Motivo: ${why}` : ""} Fale com o suporte se discordar.`,
      link: "/business",
    });
    return { id: service.id, active: service.active };
  }

  /** Pedidos recentes para acompanhamento (até 50) */
  async listHires(status?: string) {
    const valid = Object.values(StatusEnum) as string[];
    const rows = await this.hires.find({
      where: status && valid.includes(status) ? { status_provider: status as StatusEnum } : {},
      relations: { user: true, provider: true, service: true },
      order: { id: "DESC" },
      take: 50,
    });
    return rows.map((h) => ({
      id: h.id,
      title: h.service?.title ?? h.description_service,
      price: h.price,
      status: h.status,
      status_provider: h.status_provider,
      client: h.user ? { id: h.user.id, name: h.user.name } : null,
      provider: h.provider ? { id: h.provider.id, name: h.provider.companyName || h.provider.professionalName } : null,
      firstContact: h.firstContact,
      scheduledAt: h.scheduledAt,
      cancelledBy: h.cancelledBy,
      lateCancel: h.lateCancel,
    }));
  }
}

export const adminService = new AdminService();
