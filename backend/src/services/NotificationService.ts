import { In, MoreThan, Not } from "typeorm";
import { publish } from "../utils/events";
import { AppDataSource } from "../config/data-source";
import { Notification } from "../models/Notification";
import { Hire, StatusEnum } from "../models/Hire";
import { Conversation, ConversationStatus, RequestStatus } from "../models/Conversation";
import { Contract } from "../models/Contract";
import { Review } from "../models/Review";
import { ServiceProvider } from "../models/ServiceProvider";

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Algo que depende da pessoa agora (central de pendências). */
export interface PendingItem {
  kind: string;
  title: string;
  description: string;
  link: string;
  at: Date;
}

// Ouvintes externos (ex.: envio por e-mail, eventos em tempo real) recebem cada aviso criado
type Listener = (userId: number, notification: Notification) => void | Promise<void>;
const listeners: Listener[] = [];

export class NotificationService {
  private repo = AppDataSource.getRepository(Notification);

  static onCreate(listener: Listener) {
    listeners.push(listener);
  }

  /**
   * Cria um aviso. Com `dedupeMinutes`, um aviso do mesmo tipo e link ainda
   * não lido dentro desse intervalo é só atualizado (evita uma enxurrada de
   * avisos "nova mensagem").
   */
  async notify(userId: number | undefined | null, input: NotifyInput, dedupeMinutes = 0) {
    if (!userId) return null;
    if (dedupeMinutes > 0) {
      const recent = await this.repo.findOne({
        where: {
          user: { id: userId },
          type: input.type,
          link: input.link ?? "",
          read: false,
          createdAt: MoreThan(new Date(Date.now() - dedupeMinutes * 60_000)),
        },
        order: { id: "DESC" },
      });
      if (recent) {
        recent.title = input.title.slice(0, 120);
        recent.body = (input.body ?? "").slice(0, 300);
        const updated = await this.repo.save(recent);
        publish([userId], { type: "notification" });
        return updated;
      }
    }
    const saved = await this.repo.save(
      this.repo.create({
        user: { id: userId },
        type: input.type,
        title: input.title.slice(0, 120),
        body: (input.body ?? "").slice(0, 300),
        link: input.link ?? "",
      })
    );
    publish([userId], { type: "notification" });
    // ouvintes (e-mail, tempo real) rodam em segundo plano: não atrasam a resposta da API
    for (const l of listeners) {
      Promise.resolve()
        .then(() => l(userId, saved))
        .catch((err) => console.error("Falha ao processar aviso:", err?.message ?? err));
    }
    return saved;
  }

  async list(userId: number) {
    const [items, unread] = await Promise.all([
      this.repo.find({ where: { user: { id: userId } }, order: { id: "DESC" }, take: 50 }),
      this.repo.count({ where: { user: { id: userId }, read: false } }),
    ]);
    return { unread, items };
  }

  async markRead(userId: number, id?: number) {
    await this.repo.update(id ? { id, user: { id: userId } } : { user: { id: userId }, read: false }, { read: true });
    return this.list(userId);
  }

  /** Tudo o que espera uma ação da pessoa, como cliente e como prestador. */
  async pending(userId: number): Promise<PendingItem[]> {
    const items: PendingItem[] = [];
    const hireRepo = AppDataSource.getRepository(Hire);
    const convRepo = AppDataSource.getRepository(Conversation);
    const contractRepo = AppDataSource.getRepository(Contract);
    const reviewRepo = AppDataSource.getRepository(Review);
    const provider = await AppDataSource.getRepository(ServiceProvider).findOne({ where: { user: { id: userId } } });

    const title = (h: Hire) => h.service?.title ?? h.description_service;

    // ---------- como cliente
    const myHires = await hireRepo.find({
      where: { user: { id: userId }, status: Not(StatusEnum.CANCELADO) },
      relations: { service: true, provider: true },
      order: { id: "DESC" },
    });
    for (const h of myHires) {
      if (h.rescheduleTo && h.rescheduleBy === "prestador") {
        items.push({ kind: "hire.reschedule", title: "Responda ao novo horário proposto", description: `${title(h)} — ${h.provider?.companyName || h.provider?.professionalName || "prestador"}`, link: "/hires", at: h.firstContact });
      }
      if (h.status === StatusEnum.PENDENTE && h.status_provider === StatusEnum.CONCLUIDO) {
        items.push({ kind: "hire.confirm", title: "Confirme a conclusão", description: `${title(h)} — o prestador marcou como entregue`, link: "/hires", at: h.firstContact });
      }
    }

    // ---------- como prestador
    if (provider) {
      const received = await hireRepo.find({
        where: { provider: { id: provider.id }, status: StatusEnum.PENDENTE, status_provider: In([StatusEnum.PENDENTE, StatusEnum.ACEITO, StatusEnum.EM_ANDAMENTO]) },
        relations: { service: true, user: true },
        order: { id: "DESC" },
      });
      for (const h of received) {
        if (h.rescheduleTo && h.rescheduleBy === "cliente") {
          items.push({ kind: "hire.reschedule", title: "Responda ao novo horário proposto", description: `${title(h)} — ${h.user?.name ?? "cliente"}`, link: "/progress", at: h.firstContact });
        }
        if (h.status_provider === StatusEnum.PENDENTE) {
          items.push({ kind: "hire.answer", title: "Aceite ou recuse o novo pedido", description: `${title(h)} — ${h.user?.name ?? "cliente"}`, link: "/progress", at: h.firstContact });
        } else if (h.status_provider === StatusEnum.ACEITO) {
          items.push({ kind: "hire.start", title: "Inicie o serviço aceito", description: `${title(h)} — ${h.user?.name ?? "cliente"}`, link: "/progress", at: h.firstContact });
        } else {
          items.push({ kind: "hire.deliver", title: "Marque como concluído quando terminar", description: title(h), link: "/progress", at: h.firstContact });
        }
      }
    }

    // ---------- avaliações que faltam (contratações concluídas sem a minha)
    const doneWhere: any[] = [{ user: { id: userId }, status: StatusEnum.CONCLUIDO }];
    if (provider) doneWhere.push({ provider: { id: provider.id }, status: StatusEnum.CONCLUIDO });
    const done = await hireRepo.find({ where: doneWhere, relations: { service: true, user: true }, order: { id: "DESC" }, take: 30 });
    if (done.length) {
      const mine = await reviewRepo.find({ where: { author: { id: userId }, hire: { id: In(done.map((h) => h.id)) } }, relations: { hire: true } });
      const reviewed = new Set(mine.map((r) => r.hire.id));
      for (const h of done) {
        if (reviewed.has(h.id)) continue;
        const asClient = h.user?.id === userId;
        items.push({
          kind: "review",
          title: asClient ? "Avalie o prestador" : "Avalie o cliente",
          description: title(h),
          link: asClient ? "/hires" : "/progress",
          at: h.firstContact,
        });
      }
    }

    // ---------- negociações abertas
    const convWhere: any[] = [{ client: { id: userId }, status: ConversationStatus.OPEN }];
    if (provider) convWhere.push({ provider: { id: provider.id }, status: ConversationStatus.OPEN });
    const convs = await convRepo.find({ where: convWhere, relations: { client: true, provider: { user: true }, service: true } });
    for (const c of convs) {
      const role = c.client?.id === userId ? "cliente" : "prestador";
      const serviceTitle = c.service?.title ?? "negociação";
      const link = `/negotiation/${c.id}`;
      if (role === "prestador" && c.requestStatus === RequestStatus.PENDENTE) {
        items.push({ kind: "quote.respond", title: "Responda ao pedido de orçamento", description: `${serviceTitle} — ${c.client?.name ?? "cliente"}`, link: "/business", at: c.updatedAt });
        continue;
      }
      const toAccept = (c.topics ?? []).filter((t) => t.state === "Pendente" && t.content?.trim() && t.proposedBy && t.proposedBy !== role);
      if (toAccept.length) {
        items.push({ kind: "topics.review", title: "Proposta aguardando sua resposta", description: `${serviceTitle}: ${toAccept.map((t) => t.label).join(", ")}`, link, at: c.updatedAt });
      }
      const mineAccepted = role === "cliente" ? c.clientAcceptedAt : c.providerAcceptedAt;
      const otherAccepted = role === "cliente" ? c.providerAcceptedAt : c.clientAcceptedAt;
      if (otherAccepted && !mineAccepted) {
        items.push({ kind: "agreement.accept", title: "Falta o seu aceite no acordo", description: serviceTitle, link, at: c.updatedAt });
      }
    }

    // ---------- contratos sem a minha assinatura
    const contractWhere: any[] = [{ user: { id: userId } }];
    if (provider) contractWhere.push({ provider: { id: provider.id } });
    const contracts = await contractRepo.find({ where: contractWhere, relations: { user: true, provider: true }, order: { id: "DESC" }, take: 30 });
    for (const k of contracts) {
      const asClient = k.user?.id === userId;
      const signed = asClient ? k.clientSignature : k.providerSignature;
      if (!signed) {
        items.push({ kind: "contract.sign", title: "Assine o contrato", description: `${k.code} — ${k.description_service}`, link: `/contract/${k.id}`, at: new Date(k.lastContact) });
      }
    }

    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }
}

export const notificationService = new NotificationService();
