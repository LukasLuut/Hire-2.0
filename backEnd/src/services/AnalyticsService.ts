import { MoreThanOrEqual } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { AnalyticsDaily } from "../models/AnalyticsDaily";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { HttpError } from "./HireService";

/* Eventos de aquisição aceitos (lista fechada) */
export const ANALYTICS_EVENTS = [
  "profile_view",        // visualização do perfil público
  "service_view",        // visualização da página pública do serviço
  "quote_click",         // clique em pedir orçamento / contratar / conversar
  "share_click",         // abriu o compartilhamento (Web Share)
  "copy_link",           // copiou o link
  "whatsapp_share",      // compartilhou pelo WhatsApp
  "qr_open",             // abriu/baixou o QR Code
  "request_from_profile",// pedido de orçamento enviado a partir do perfil público
  "hire_from_profile",   // contratação feita a partir do perfil público
  "signup_from_invite",  // cadastro com código de convite (registrado pelo servidor)
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export const ANALYTICS_SOURCES = ["direct", "link", "whatsapp", "qr", "invite", "search", "social"] as const;

/** Data local do servidor (AAAA-MM-DD): o dia vira à meia-noite local, não em UTC */
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localDay();

export class AnalyticsService {
  private repo = AppDataSource.getRepository(AnalyticsDaily);

  /** Soma 1 ao contador do dia (upsert atômico no MySQL) */
  async record(event: AnalyticsEvent, opts: { providerId?: number; serviceId?: number; source?: string } = {}) {
    const source = (ANALYTICS_SOURCES as readonly string[]).includes(opts.source ?? "") ? opts.source! : "direct";
    await this.repo.query(
      "INSERT INTO analytics_daily (day, event, providerId, serviceId, source, count) VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1",
      [today(), event, opts.providerId ?? 0, opts.serviceId ?? 0, source]
    );
  }

  /** Evento vindo do navegador: valida evento, prestador e serviço antes de contar */
  async track(body: { event?: unknown; providerId?: unknown; serviceId?: unknown; source?: unknown }) {
    const event = String(body.event ?? "") as AnalyticsEvent;
    // cadastro por convite só o servidor registra
    if (!(ANALYTICS_EVENTS as readonly string[]).includes(event) || event === "signup_from_invite") throw new HttpError(400, "Evento inválido");
    let providerId = Number(body.providerId) || 0;
    const serviceId = Number(body.serviceId) || 0;
    if (serviceId) {
      const s = await AppDataSource.getRepository(Service).findOne({ where: { id: serviceId }, relations: { provider: true }, select: { id: true, provider: { id: true } } });
      if (!s) throw new HttpError(400, "Serviço inválido");
      providerId = s.provider?.id ?? providerId;
    } else if (providerId) {
      const exists = await AppDataSource.getRepository(ServiceProvider).exists({ where: { id: providerId } });
      if (!exists) throw new HttpError(400, "Prestador inválido");
    }
    await this.record(event, { providerId, serviceId, source: String(body.source ?? "") });
    return { ok: true };
  }

  /** Totais do prestador nos últimos N dias: por evento e por origem das visitas */
  async forProvider(providerId: number, days = 30) {
    const since = localDay(new Date(Date.now() - (days - 1) * 86400000));
    const rows = await this.repo.find({ where: { providerId, day: MoreThanOrEqual(since) } });
    const totals: Record<string, number> = Object.fromEntries(ANALYTICS_EVENTS.map((e) => [e, 0]));
    const viewSources: Record<string, number> = {};
    for (const r of rows) {
      totals[r.event] = (totals[r.event] ?? 0) + r.count;
      if (r.event === "profile_view" || r.event === "service_view") viewSources[r.source] = (viewSources[r.source] ?? 0) + r.count;
    }
    return { days, totals, viewSources };
  }

  /** Totais gerais (administração) */
  async overall(days = 30) {
    const since = localDay(new Date(Date.now() - (days - 1) * 86400000));
    const rows = await this.repo
      .createQueryBuilder("a")
      .select("a.event", "event")
      .addSelect("SUM(a.count)", "count")
      .where("a.day >= :since", { since })
      .groupBy("a.event")
      .getRawMany();
    return Object.fromEntries(rows.map((r) => [r.event, Number(r.count)]));
  }
}

export const analyticsService = new AnalyticsService();
