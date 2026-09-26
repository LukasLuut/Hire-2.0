import { AppDataSource } from "../config/data-source";
import { SUPPORT_CATEGORIES, SupportStatus, SupportTicket, type SupportCategory } from "../models/SupportTicket";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Chamados de suporte: o usuário abre e acompanha; a administração responde e encerra. */
export class SupportService {
  private repo = AppDataSource.getRepository(SupportTicket);

  private present(t: SupportTicket, withUser = false) {
    return {
      id: t.id,
      category: t.category,
      subject: t.subject,
      message: t.message,
      status: t.status,
      reply: t.reply,
      answeredAt: t.answeredAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      ...(withUser ? { user: t.user ? { id: t.user.id, name: t.user.name, email: t.user.email } : null } : {}),
    };
  }

  async create(userId: number, data: { category?: unknown; subject?: unknown; message?: unknown }) {
    const category = String(data.category ?? "") as SupportCategory;
    if (!SUPPORT_CATEGORIES.includes(category)) throw new HttpError(400, "Escolha o assunto do chamado");
    const subject = text(data.subject, 120);
    const message = text(data.message, 2000);
    if (subject.length < 3) throw new HttpError(400, "Dê um título ao chamado");
    if (message.length < 10) throw new HttpError(400, "Descreva o que aconteceu (pelo menos 10 caracteres)");
    const open = await this.repo.count({ where: { user: { id: userId }, status: SupportStatus.ABERTO } });
    if (open >= 5) throw new HttpError(400, "Você já tem 5 chamados em aberto. Aguarde a resposta antes de abrir outro.");
    const saved = await this.repo.save(this.repo.create({ user: { id: userId }, category, subject, message }));
    return this.present(saved);
  }

  async mine(userId: number) {
    const list = await this.repo.find({ where: { user: { id: userId } }, order: { id: "DESC" } });
    return list.map((t) => this.present(t));
  }

  async adminList(status?: string) {
    const where = status && (Object.values(SupportStatus) as string[]).includes(status) ? { status: status as SupportStatus } : {};
    const list = await this.repo.find({ where, relations: { user: true }, order: { id: "DESC" }, take: 200 });
    return list.map((t) => this.present(t, true));
  }

  /** Resposta (opcional) e mudança de situação; quem abriu é avisado. */
  async answer(id: number, data: { status?: unknown; reply?: unknown }, adminId: number) {
    const ticket = await this.repo.findOne({ where: { id }, relations: { user: true } });
    if (!ticket) throw new HttpError(404, "Chamado não encontrado");
    const status = String(data.status ?? "");
    if (!(Object.values(SupportStatus) as string[]).includes(status)) throw new HttpError(400, "Situação inválida");
    const reply = text(data.reply, 2000);
    if (status === SupportStatus.RESOLVIDO && !reply && !ticket.reply) throw new HttpError(400, "Escreva uma resposta antes de encerrar");
    ticket.status = status as SupportStatus;
    if (reply) {
      ticket.reply = reply;
      ticket.answeredBy = { id: adminId } as any;
      ticket.answeredAt = new Date();
    }
    await this.repo.save(ticket);
    if (reply || ticket.status === SupportStatus.RESOLVIDO) {
      await notificationService.notify(ticket.user?.id, {
        type: "support.answered",
        title: `Suporte: ${ticket.subject}`,
        body: reply ? reply.slice(0, 140) : "Seu chamado foi encerrado.",
        link: "/ajuda",
      });
    }
    return this.present(ticket, true);
  }

  async openCount() {
    return this.repo.count({ where: { status: SupportStatus.ABERTO } });
  }
}

export const supportService = new SupportService();
