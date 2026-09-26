import crypto from "crypto";
import { IsNull } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Invite } from "../models/Invite";
import { User } from "../models/User";
import { ServiceProvider } from "../models/ServiceProvider";
import { HttpError } from "./HireService";
import { analyticsService } from "./AnalyticsService";
import { frontendUrl } from "./MailService";

type Kind = "provider" | "client";
const KINDS: Kind[] = ["provider", "client"];

/* Convites rastreáveis: criação, página pública do convite, cadastro atribuído e conversão. */
export class InviteService {
  private invites = AppDataSource.getRepository(Invite);
  private users = AppDataSource.getRepository(User);
  private providers = AppDataSource.getRepository(ServiceProvider);

  private url = (code: string) => `${frontendUrl()}/convite/${code}`;

  /** Cria (ou reaproveita) o convite do usuário para esse tipo e contexto */
  async create(userId: number, data: { kind?: unknown; context?: unknown }) {
    const kind = String(data.kind ?? "") as Kind;
    if (!KINDS.includes(kind)) throw new HttpError(400, "Escolha quem você quer convidar");
    const context = String(data.context ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const existing = await this.invites.findOne({ where: { inviter: { id: userId }, kind, context } });
    if (existing) return { code: existing.code, url: this.url(existing.code), kind, context };
    const isProvider = await this.providers.exists({ where: { user: { id: userId } } });
    const code = crypto.randomBytes(6).toString("base64url"); // 8 caracteres
    await this.invites.save(this.invites.create({ code, inviter: { id: userId }, kind, context, inviterRole: isProvider ? "prestador" : "cliente" }));
    return { code, url: this.url(code), kind, context };
  }

  /** Dados públicos do convite: só o primeiro nome de quem convidou */
  async publicInfo(code: string) {
    if (!/^[\w-]{6,16}$/.test(code)) throw new HttpError(404, "Convite não encontrado");
    const inv = await this.invites.findOne({ where: { code }, relations: { inviter: true } });
    if (!inv) throw new HttpError(404, "Convite não encontrado");
    return { kind: inv.kind, context: inv.context, inviterFirstName: (inv.inviter?.name ?? "").split(" ")[0] || "Alguém" };
  }

  /** Cadastro com código de convite: guarda a origem e registra a métrica */
  async attachOnSignup(userId: number, code: unknown) {
    const c = String(code ?? "");
    if (!/^[\w-]{6,16}$/.test(c)) return;
    const inv = await this.invites.findOne({ where: { code: c }, relations: { inviter: true } });
    if (!inv || inv.inviter?.id === userId) return;
    await this.users.update(userId, { invite: { id: inv.id } as any });
    const provider = await this.providers.findOne({ where: { user: { id: inv.inviter.id } }, select: { id: true } });
    await analyticsService.record("signup_from_invite", { providerId: provider?.id ?? 0, source: "invite" }).catch(() => {});
  }

  /**
   * Conversão: o convidado fez o que o convite propunha — criou a empresa (convite de
   * profissional) ou fez o primeiro pedido (convite de cliente). Só conta uma vez.
   */
  async markConverted(userId: number, action: "provider" | "client") {
    const user = await this.users.findOne({ where: { id: userId, inviteConvertedAt: IsNull() }, relations: { invite: true } });
    if (!user?.invite || user.invite.kind !== action) return;
    await this.users.update(userId, { inviteConvertedAt: new Date() });
  }

  /** Convites do usuário com cadastros e conversões */
  async mine(userId: number) {
    const rows: { id: number; code: string; kind: Kind; inviterRole: string; context: string; createdAt: Date; signups: string; converted: string }[] =
      await AppDataSource.query(
        `SELECT i.id, i.code, i.kind, i.inviterRole, i.context, i.createdAt,
                COUNT(u.id) AS signups, COUNT(u.inviteConvertedAt) AS converted
         FROM invites i LEFT JOIN users u ON u.inviteId = i.id
         WHERE i.inviterId = ? GROUP BY i.id ORDER BY i.id DESC`,
        [userId]
      );
    return rows.map((r) => ({ ...r, url: this.url(r.code), signups: Number(r.signups), converted: Number(r.converted) }));
  }
}

export const inviteService = new InviteService();
