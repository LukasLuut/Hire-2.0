import { AppDataSource } from "../config/data-source";
import { In, IsNull } from "typeorm";
import type { EntityManager } from "typeorm";
import { profileAddress } from "./HireService";
import { fileUrl, privateRef } from "../utils/signedFile";
import { durationMinutes } from "../utils/schedule";
import { OFFLINE_MESSAGE, providerOffline } from "../utils/availability";
import { closedMessage, openState } from "../utils/openStatus";
import { inviteService } from "./InviteService";
import { Conversation } from "../models/Conversation";
import { Negotiation, NegotiationOrigin, NegotiationStatus, NegotiationTopic, Party, QuoteRequest, RequestStatus } from "../models/Negotiation";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";
import { Message, MessageEvent, MessageRole } from "../models/Message";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { Hire, StatusEnum } from "../models/Hire";
import { Contract } from "../models/Contract";
import { publish } from "../utils/events";

/** Tamanho máximo de uma mensagem de texto */
export const MESSAGE_MAX = 2000;
const CLOSED = "Esta negociação já foi encerrada";

// Tópicos iniciais de uma negociação
function defaultTopics(service?: Service | null): NegotiationTopic[] {
  // o que veio do anúncio conta como proposta do prestador
  const fromListing = (content: string): Pick<NegotiationTopic, "content" | "proposedBy"> => ({ content, proposedBy: content ? "prestador" : null });
  return [
    { key: "service", label: "Serviço previsto", tooltip: "Descrição e escopo do serviço (o que será entregue).", state: "Pendente", ...fromListing(service?.title ?? "") },
    { key: "payment", label: "Valor & método", tooltip: "Valor acordado e forma de pagamento.", state: "Pendente", ...fromListing(service ? String(service.price).replace(".", ",") : "") },
    { key: "start", label: "Data e hora de início", tooltip: "Defina quando o serviço deve começar.", state: "Pendente", content: "" },
    { key: "duration", label: "Duração", tooltip: "Tempo estimado para entrega / realização do serviço.", state: "Pendente", ...fromListing(service?.duration ?? "") },
    { key: "finalize", label: "Finalizar", tooltip: "Formalize o serviço ou encerre a negociação.", state: "Acordado", content: "" },
  ];
}

// Primeiro número encontrado no texto do tópico de pagamento: "R$ 1.250,50 • Pix" → 1250.5
export function extractAmount(text: string): number {
  const match = text.replace(/\s/g, "").match(/\d[\d.]*(,\d{1,2})?|\d+(\.\d{1,2})?/);
  if (!match) return NaN;
  const raw = match[0];
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

const other = (p: Party): Party => (p === "cliente" ? "prestador" : "cliente");

/** De quem a negociação aberta espera o próximo passo (null = de ninguém / encerrada) */
function waitingFor(n: Negotiation): Party | null {
  if (n.status !== NegotiationStatus.OPEN) return null;
  if (n.requestStatus === RequestStatus.PENDENTE) return "prestador";
  const topics = n.topics ?? defaultTopics(n.service);
  const pending = topics.filter((t) => t.state !== "Acordado");
  if (pending.length) {
    // proposta com conteúdo espera a outra parte; tópico vazio espera qualquer um (fica com quem não propôs por último)
    const proposed = pending.find((t) => t.content?.trim() && t.proposedBy);
    return proposed ? other(proposed.proposedBy as Party) : null;
  }
  if (!n.clientAcceptedAt && !n.providerAcceptedAt) return null; // os dois podem aceitar
  if (!n.clientAcceptedAt) return "cliente";
  if (!n.providerAcceptedAt) return "prestador";
  return null;
}

type ListOptions = { limit?: number; offset?: number; q?: string; filter?: "unread" | "negotiating" | "" };

export class ConversationService {
  private conversationRepository = AppDataSource.getRepository(Conversation);
  private negotiationRepository = AppDataSource.getRepository(Negotiation);
  private messageRepository = AppDataSource.getRepository(Message);
  private providerRepository = AppDataSource.getRepository(ServiceProvider);
  private serviceRepository = AppDataSource.getRepository(Service);

  private readonly convRelations = { client: true, provider: { user: true, category: true } } as const;
  private readonly negRelations = { service: true, hire: true, contract: true } as const;

  // ---------------------------------------------------------------- papéis e apresentação

  private roleOf(conv: Conversation, userId: number): Party | null {
    if (conv.client?.id === userId) return "cliente";
    if (conv.provider?.user?.id === userId) return "prestador";
    return null;
  }

  private presentNegotiation(n: Negotiation) {
    return {
      id: n.id,
      status: n.status,
      origin: n.origin,
      createdBy: n.createdBy,
      title: n.title || n.service?.title || "Negociação",
      topics: n.topics ?? defaultTopics(n.service),
      service: n.service ? { id: n.service.id, title: n.service.title, price: n.service.price, duration: n.service.duration, description: n.service.description_service } : null,
      request: n.request ?? null,
      requestStatus: n.requestStatus ?? null,
      rejectReason: n.rejectReason ?? null,
      closedBy: n.closedBy ?? null,
      closeReason: n.closeReason ?? null,
      clientAcceptedAt: n.clientAcceptedAt ?? null,
      providerAcceptedAt: n.providerAcceptedAt ?? null,
      hireId: n.hire?.id ?? null,
      contractId: n.contract?.id ?? null,
      contractCode: n.contract?.code ?? null,
      waitingFor: waitingFor(n),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  /** Negociação em destaque: a aberta mexida por último; sem aberta, a mais recente */
  private current(negotiations: Negotiation[], focusId?: number) {
    const focused = focusId ? negotiations.find((n) => n.id === focusId) : undefined;
    if (focused) return focused;
    const byUpdate = [...negotiations].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt) || b.id - a.id);
    return byUpdate.find((n) => n.status === NegotiationStatus.OPEN) ?? byUpdate[0] ?? null;
  }

  private present(
    conv: Conversation,
    userId: number,
    extra: { negotiations?: Negotiation[]; last?: Message | null; unread?: number; focusId?: number } = {}
  ) {
    const role = this.roleOf(conv, userId);
    const negotiations = extra.negotiations ?? [];
    const cur = this.current(negotiations, extra.focusId);
    const curView = cur ? this.presentNegotiation(cur) : null;
    const open = negotiations.filter((n) => n.status === NegotiationStatus.OPEN);
    return {
      id: conv.id,
      myRole: role,
      client: conv.client ? { id: conv.client.id, name: conv.client.name, avatarUrl: conv.client.avatarUrl ?? null } : null,
      provider: conv.provider
        ? {
            id: conv.provider.id,
            companyName: conv.provider.companyName,
            professionalName: conv.provider.professionalName,
            profileImageUrl: conv.provider.profileImageUrl,
            slug: conv.provider.slug ?? null,
            userId: conv.provider.user?.id,
          }
        : null,
      lastMessage: extra.last ? { text: extra.last.text, role: extra.last.role, event: extra.last.event ?? null, createdAt: extra.last.createdAt } : null,
      lastMessageAt: conv.lastMessageAt ?? null,
      unread: extra.unread ?? 0,
      openNegotiations: open.length,
      waitingForMe: !!role && open.some((n) => waitingFor(n) === role),
      negotiation: curView,
      updatedAt: conv.updatedAt,
      // campos da negociação em destaque, no formato antigo (telas e integrações da v1)
      negotiationId: curView?.id ?? null,
      status: curView?.status ?? NegotiationStatus.OPEN,
      topics: curView?.topics ?? [],
      service: curView?.service ?? null,
      request: curView?.request ?? null,
      requestStatus: curView?.requestStatus ?? null,
      rejectReason: curView?.rejectReason ?? null,
      closedBy: curView?.closedBy ?? null,
      closeReason: curView?.closeReason ?? null,
      clientAcceptedAt: curView?.clientAcceptedAt ?? null,
      providerAcceptedAt: curView?.providerAcceptedAt ?? null,
      hireId: curView?.hireId ?? null,
      contractId: curView?.contractId ?? null,
    };
  }

  // ---------------------------------------------------------------- carregamento

  private async load(id: number, userId: number) {
    const conv = await this.conversationRepository.findOne({ where: { id }, relations: this.convRelations });
    if (!conv) throw new HttpError(404, "Conversa não encontrada");
    if (!this.roleOf(conv, userId)) throw new HttpError(403, "Você não participa desta conversa");
    return conv;
  }

  private negotiationsOf(convIds: number[]) {
    if (!convIds.length) return Promise.resolve([] as Negotiation[]);
    return this.negotiationRepository.find({
      where: { conversation: { id: In(convIds) } },
      relations: { ...this.negRelations, conversation: true },
      order: { id: "ASC" },
    });
  }

  /** Resumo da conversa; com `focusId`, os campos da v1 mostram aquela negociação */
  private async summary(conv: Conversation, userId: number, focusId?: number) {
    const [negotiations, last, unread] = await Promise.all([
      this.negotiationsOf([conv.id]),
      this.messageRepository.findOne({ where: { conversation: { id: conv.id } }, order: { id: "DESC" } }),
      this.unreadCounts([conv], userId).then((m) => m.get(conv.id) ?? 0),
    ]);
    return this.present(conv, userId, { negotiations, last, unread, focusId });
  }

  /**
   * Negociação alvo de uma ação. Sem id, vale a aberta em destaque (rotas da v1).
   * `openOnly` recusa negociação já encerrada.
   */
  private async negotiationFor(conv: Conversation, negotiationId?: number | null, openOnly = true) {
    let n: Negotiation | null;
    if (negotiationId) {
      n = await this.negotiationRepository.findOne({ where: { id: negotiationId, conversation: { id: conv.id } }, relations: this.negRelations });
      if (!n) throw new HttpError(404, "Negociação não encontrada nesta conversa");
    } else {
      n = this.current(await this.negotiationRepository.find({ where: { conversation: { id: conv.id } }, relations: this.negRelations }));
      if (!n) throw new HttpError(400, "Nenhuma negociação nesta conversa");
    }
    if (openOnly && n.status !== NegotiationStatus.OPEN) throw new HttpError(400, CLOSED);
    return n;
  }

  /** id do usuário da outra parte */
  private otherUserId(conv: Conversation, userId: number) {
    return conv.client?.id === userId ? conv.provider?.user?.id : conv.client?.id;
  }

  private nameOf(conv: Conversation, userId: number) {
    return conv.client?.id === userId ? conv.client?.name ?? "O cliente" : conv.provider?.companyName || conv.provider?.professionalName || "O prestador";
  }

  private providerName(conv: Conversation) {
    return conv.provider?.companyName || conv.provider?.professionalName || "Prestador";
  }

  /** Mensagem de sistema; com negociação e evento vira card na conversa */
  private async system(conv: Conversation, text: string, m?: EntityManager, n?: Negotiation | null, event?: MessageEvent) {
    const repo = m ? m.getRepository(Message) : this.messageRepository;
    await repo.save(repo.create({ conversation: { id: conv.id }, role: MessageRole.SYSTEM, text, sender: null, negotiation: n ? { id: n.id } : null, event: event ?? null }));
    await this.touch(conv.id, m);
  }

  /** Atualiza a hora da última mensagem sem disparar aviso em tempo real (a mensagem já avisou) */
  private async touch(convId: number, m?: EntityManager, readBy?: Party) {
    const now = new Date();
    const set: Record<string, Date> = { lastMessageAt: now };
    if (readBy === "cliente") set.clientLastReadAt = now;
    if (readBy === "prestador") set.providerLastReadAt = now;
    await (m ?? AppDataSource.manager).createQueryBuilder().update(Conversation).set(set).where("id = :id", { id: convId }).callListeners(false).execute();
  }

  /** Conversa do par cliente ↔ prestador; cria na primeira vez */
  private async pair(clientId: number, providerId: number) {
    const where = { client: { id: clientId }, provider: { id: providerId } };
    let conv = await this.conversationRepository.findOne({ where, relations: this.convRelations });
    if (conv) return conv;
    try {
      await this.conversationRepository.insert({ client: { id: clientId }, provider: { id: providerId }, clientLastReadAt: new Date(), providerLastReadAt: new Date() });
    } catch (err: any) {
      if (err?.code !== "ER_DUP_ENTRY") throw err; // outra aba criou ao mesmo tempo
    }
    conv = await this.conversationRepository.findOne({ where, relations: this.convRelations });
    if (!conv) throw new HttpError(500, "Não foi possível abrir a conversa");
    return conv;
  }

  private async providerOr404(id: number) {
    const provider = await this.providerRepository.findOne({ where: { id }, relations: { user: true, category: true } });
    if (!provider) throw new HttpError(404, "Prestador não encontrado");
    return provider;
  }

  // ---------------------------------------------------------------- conversa

  /**
   * Abre a conversa com o prestador (uma só por par). Com `serviceId`, garante também uma
   * negociação aberta daquele serviço (reaproveita a que já existir).
   */
  async open(userId: number, data: { providerId?: number | string; serviceId?: number | string; general?: boolean }) {
    let service: Service | null = null;
    if (data.serviceId) {
      service = await this.serviceRepository.findOne({ where: { id: Number(data.serviceId) }, relations: { provider: true } });
      if (!service) throw new HttpError(404, "Serviço não encontrado");
    }
    const provider = await this.providerOr404(Number(data.providerId ?? service?.provider?.id));
    if (providerOffline(provider)) throw new HttpError(400, OFFLINE_MESSAGE);
    if (provider.user?.id === userId) throw new HttpError(400, "Você não pode negociar com o seu próprio perfil");

    const conv = await this.pair(userId, provider.id);
    const n = service ? await this.ensureServiceNegotiation(conv, "cliente", service) : null;
    return this.summary(conv, userId, n?.id);
  }

  /** Negociação aberta de um serviço listado; reaproveita a que existir (e a põe em destaque) */
  private async ensureServiceNegotiation(conv: Conversation, by: Party, service: Service) {
    if (service.active === false) throw new HttpError(400, "Este serviço foi pausado pelo prestador e não recebe pedidos no momento");
    const existing = await this.negotiationRepository.findOne({
      where: { conversation: { id: conv.id }, service: { id: service.id }, status: NegotiationStatus.OPEN },
      relations: this.negRelations,
      order: { updatedAt: "DESC" },
    });
    if (existing) {
      await this.negotiationRepository.update(existing.id, { updatedAt: new Date() });
      return existing;
    }
    const n = await this.negotiationRepository.save(
      this.negotiationRepository.create({
        conversation: { id: conv.id },
        service: { id: service.id },
        origin: "servico",
        createdBy: by,
        title: service.title.slice(0, 120),
        topics: defaultTopics(service),
      })
    );
    await this.system(conv, `Nova negociação: ${service.title}. Ajustem os tópicos até os dois concordarem.`, undefined, n, "negotiation.opened");
    return n;
  }

  /** Conversas do usuário, da mais recente para a mais antiga (páginas, busca e filtros) */
  async listMine(userId: number, opts: ListOptions = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
    const offset = Math.max(Number(opts.offset) || 0, 0);
    const qb = this.conversationRepository
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.client", "cl")
      .leftJoinAndSelect("c.provider", "p")
      .leftJoinAndSelect("p.user", "pu")
      .where("(cl.id = :u OR pu.id = :u)", { u: userId });
    const term = String(opts.q ?? "").trim();
    if (term) {
      qb.andWhere(
        "(cl.name LIKE :q OR p.companyName LIKE :q OR p.professionalName LIKE :q OR EXISTS (SELECT 1 FROM negotiations nq WHERE nq.conversationId = c.id AND nq.title LIKE :q))",
        { q: `%${term.replace(/[%_]/g, "")}%` }
      );
    }
    if (opts.filter === "negotiating") {
      qb.andWhere("EXISTS (SELECT 1 FROM negotiations nf WHERE nf.conversationId = c.id AND nf.status = 'OPEN')");
    }
    if (opts.filter === "unread") {
      qb.andWhere(
        "EXISTS (SELECT 1 FROM messages mu WHERE mu.conversationId = c.id AND (mu.senderId IS NULL OR mu.senderId <> :u) AND mu.createdAt > COALESCE(CASE WHEN cl.id = :u THEN c.clientLastReadAt ELSE c.providerLastReadAt END, '1970-01-01'))"
      );
    }
    const convs = await qb.orderBy("COALESCE(c.lastMessageAt, c.createdAt)", "DESC").addOrderBy("c.id", "DESC").limit(limit).offset(offset).getMany();
    if (!convs.length) return [];

    const ids = convs.map((c) => c.id);
    const [negotiations, lastMessages, unread] = await Promise.all([
      this.negotiationsOf(ids),
      this.messageRepository
        .createQueryBuilder("m")
        .leftJoin("m.conversation", "mc")
        .addSelect("mc.id")
        .where("m.id IN (SELECT MAX(x.id) FROM messages x WHERE x.conversationId IN (:...ids) GROUP BY x.conversationId)", { ids })
        .getMany(),
      this.unreadCounts(convs, userId),
    ]);
    const byConv = new Map<number, Negotiation[]>();
    for (const n of negotiations) byConv.set(n.conversation.id, [...(byConv.get(n.conversation.id) ?? []), n]);
    const lastByConv = new Map(lastMessages.map((m) => [m.conversation.id, m]));
    return convs.map((c) => this.present(c, userId, { negotiations: byConv.get(c.id) ?? [], last: lastByConv.get(c.id) ?? null, unread: unread.get(c.id) ?? 0 }));
  }

  /** Uma linha por negociação (painel do prestador, página "Negociações"), mais recentes primeiro */
  async listNegotiations(userId: number) {
    const rows = await this.negotiationRepository.find({
      where: [{ conversation: { client: { id: userId } } }, { conversation: { provider: { user: { id: userId } } } }],
      relations: { ...this.negRelations, conversation: this.convRelations },
      order: { updatedAt: "DESC" },
      take: 300,
    });
    return rows.map((n) => this.present(n.conversation, userId, { negotiations: [n] }));
  }

  /** Mensagens da outra parte (e do sistema) depois da última leitura, por conversa — uma consulta */
  private async unreadCounts(convs: Conversation[], userId: number) {
    const result = new Map<number, number>();
    if (!convs.length) return result;
    const rows: { cid: number; n: string }[] = await this.messageRepository
      .createQueryBuilder("m")
      .innerJoin("m.conversation", "c")
      .innerJoin("c.client", "cl")
      .select("c.id", "cid")
      .addSelect("COUNT(*)", "n")
      .where("c.id IN (:...ids)", { ids: convs.map((c) => c.id) })
      .andWhere("(m.senderId IS NULL OR m.senderId <> :u)", { u: userId })
      .andWhere("m.createdAt > COALESCE(CASE WHEN cl.id = :u THEN c.clientLastReadAt ELSE c.providerLastReadAt END, '1970-01-01')")
      .groupBy("c.id")
      .getRawMany();
    for (const r of rows) result.set(Number(r.cid), Number(r.n));
    return result;
  }

  async get(id: number, userId: number, afterId?: number) {
    const conv = await this.load(id, userId);
    const qb = this.messageRepository
      .createQueryBuilder("m")
      .leftJoin("m.sender", "s")
      .addSelect(["s.id", "s.name"])
      .leftJoin("m.negotiation", "n")
      .addSelect(["n.id"])
      .where("m.conversationId = :id", { id })
      .orderBy("m.id", "ASC");
    if (afterId) qb.andWhere("m.id > :afterId", { afterId });
    const [messages, negotiations, unread] = await Promise.all([qb.getMany(), this.negotiationsOf([conv.id]), this.unreadCounts([conv], userId)]);
    const last = messages[messages.length - 1] ?? (await this.messageRepository.findOne({ where: { conversation: { id: conv.id } }, order: { id: "DESC" } }));
    return {
      ...this.present(conv, userId, { negotiations, last, unread: unread.get(conv.id) ?? 0 }),
      negotiations: negotiations.map((n) => this.presentNegotiation(n)).reverse(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        event: m.event ?? null,
        negotiationId: m.negotiation?.id ?? null,
        attachmentUrl: fileUrl(m.attachmentUrl),
        attachmentName: m.attachmentName,
        createdAt: m.createdAt,
        sender: m.sender ? { id: m.sender.id, name: m.sender.name } : null,
      })),
    };
  }

  /** Marca a conversa como lida por quem chamou (sem aviso em tempo real, para não ecoar) */
  async markRead(id: number, userId: number) {
    const conv = await this.load(id, userId);
    const col = this.roleOf(conv, userId) === "cliente" ? "clientLastReadAt" : "providerLastReadAt";
    await AppDataSource.manager.createQueryBuilder().update(Conversation).set({ [col]: new Date() }).where("id = :id", { id }).callListeners(false).execute();
    return { ok: true };
  }

  /** Mensagem livre: a conversa nunca fecha, com ou sem negociação aberta */
  async sendMessage(id: number, userId: number, text: string, file?: Express.Multer.File) {
    const conv = await this.load(id, userId);
    const clean = String(text ?? "").trim();
    if (!clean && !file) throw new HttpError(400, "Escreva uma mensagem ou anexe um arquivo");
    if (clean.length > MESSAGE_MAX) throw new HttpError(400, `Mensagem muito longa (máximo ${MESSAGE_MAX.toLocaleString("pt-BR")} caracteres)`);
    const role = this.roleOf(conv, userId)!;
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        conversation: { id: conv.id },
        sender: { id: userId },
        role: role as MessageRole,
        text: clean || (file ? "Arquivo enviado" : ""),
        attachmentUrl: file ? privateRef(file.filename) : null,
        attachmentName: file ? file.originalname : null,
      })
    );
    await this.touch(conv.id, undefined, role);
    await notificationService.notify(
      this.otherUserId(conv, userId),
      { type: "message", title: `Nova mensagem de ${this.nameOf(conv, userId)}`, body: message.text.slice(0, 140), link: `/negotiation/${conv.id}` },
      30
    );
    return message.id;
  }

  // ---------------------------------------------------------------- negociações

  /**
   * Abre uma negociação dentro da conversa:
   * - `serviceId`: serviço já listado (qualquer parte);
   * - `custom`: proposta sob medida montada pelo prestador, com opção de salvar no catálogo;
   * - `proposal`: o cliente descreve o que precisa (mesmo fluxo do pedido de orçamento).
   */
  async createNegotiation(
    id: number,
    userId: number,
    data: {
      serviceId?: number | string;
      custom?: { title?: string; description?: string; price?: string; duration?: string; start?: string; saveToCatalog?: boolean | string };
      proposal?: Partial<QuoteRequest>;
    },
    files: Express.Multer.File[] = []
  ) {
    const conv = await this.load(id, userId);
    const role = this.roleOf(conv, userId)!;
    if (providerOffline(conv.provider)) throw new HttpError(400, OFFLINE_MESSAGE);

    if (data.serviceId) {
      const service = await this.serviceRepository.findOne({ where: { id: Number(data.serviceId), provider: { id: conv.provider.id } } });
      if (!service) throw new HttpError(404, "Serviço não encontrado entre os serviços deste prestador");
      const n = await this.ensureServiceNegotiation(conv, role, service);
      await this.notifyOther(conv, userId, "negotiation.opened", `Nova negociação: ${service.title}`, `${this.nameOf(conv, userId)} quer negociar este serviço.`);
      return await this.summary(conv, userId, n.id);
    }

    if (data.custom) {
      if (role !== "prestador") throw new HttpError(403, "Só o prestador cria uma proposta sob medida");
      const title = String(data.custom.title ?? "").trim().slice(0, 100);
      const description = String(data.custom.description ?? "").trim().slice(0, 400);
      const price = String(data.custom.price ?? "").trim().slice(0, 100);
      const duration = String(data.custom.duration ?? "").trim().slice(0, 100);
      const start = String(data.custom.start ?? "").trim().slice(0, 100);
      if (!title || !description || !price) throw new HttpError(400, "Informe título, descrição e valor da proposta");
      const amount = extractAmount(price);
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Informe um valor válido para a proposta");

      let service: Service | null = null;
      if (data.custom.saveToCatalog === true || data.custom.saveToCatalog === "true") {
        if (!conv.provider.category) throw new HttpError(400, "Escolha a categoria do seu perfil antes de salvar serviços no catálogo");
        service = await this.serviceRepository.save(
          this.serviceRepository.create({
            title,
            description_service: description.slice(0, 250),
            negotiable: true,
            requiresScheduling: false,
            online: false,
            price: amount,
            duration: duration || "A combinar",
            provider: { id: conv.provider.id },
            category: { id: conv.provider.category.id },
          })
        );
      }
      const byProvider = (content: string) => ({ content: content.slice(0, 500), state: "Pendente" as const, proposedBy: "prestador" as const });
      const topics = defaultTopics(null).map((t) => {
        if (t.key === "service") return { ...t, ...byProvider(`${title} — ${description}`) };
        if (t.key === "payment") return { ...t, ...byProvider(price) };
        if (t.key === "duration" && duration) return { ...t, ...byProvider(duration) };
        if (t.key === "start" && start) return { ...t, ...byProvider(start) };
        return t;
      });
      const n = await this.negotiationRepository.save(
        this.negotiationRepository.create({ conversation: { id: conv.id }, service: service ? { id: service.id } : null, origin: "sob_medida", createdBy: "prestador", title, topics })
      );
      await this.system(conv, `${this.providerName(conv)} criou uma proposta sob medida: ${title} (${price}).`, undefined, n, "negotiation.proposal");
      await this.attach(conv, userId, role, files, n);
      await this.notifyOther(conv, userId, "quote.responded", `Proposta sob medida: ${title}`, `${this.nameOf(conv, userId)} montou uma proposta para você: ${price}.`);
      return await this.summary(conv, userId, n.id);
    }

    if (data.proposal) {
      if (role !== "cliente") throw new HttpError(403, "Só o cliente faz um pedido");
      const n = await this.openRequest(conv, userId, null, data.proposal, files);
      return await this.summary(conv, userId, n.id);
    }

    throw new HttpError(400, "Escolha um serviço, uma proposta sob medida ou descreva o pedido");
  }

  private async notifyOther(conv: Conversation, userId: number, type: string, title: string, body: string) {
    await notificationService.notify(this.otherUserId(conv, userId), { type, title, body, link: `/negotiation/${conv.id}` });
  }

  /**
   * Atualiza os tópicos com consentimento mútuo:
   * - mudar o conteúdo vira uma proposta de quem mudou (fica Pendente);
   * - só a outra parte pode marcar uma proposta como Acordado;
   * - qualquer mudança desfaz os aceites finais do acordo.
   */
  async updateTopics(id: number, userId: number, topics: NegotiationTopic[], note?: string, negotiationId?: number) {
    const conv = await this.load(id, userId);
    const n = await this.negotiationFor(conv, negotiationId);
    if (!Array.isArray(topics) || topics.length > 10) throw new HttpError(400, "Tópicos inválidos");
    const role = this.roleOf(conv, userId) as Party;
    const previous = new Map((n.topics ?? defaultTopics(n.service)).map((t) => [t.key, t]));

    n.topics = topics.map((t): NegotiationTopic => {
      const key = String(t.key).slice(0, 40);
      const before = previous.get(key);
      const content = String(t.content ?? "").trim().slice(0, 500);
      const wanted = t.state === "Acordado" || t.state === "Negado" ? t.state : "Pendente";
      const base = { key, label: String(t.label ?? before?.label ?? key).slice(0, 60), tooltip: t.tooltip ?? before?.tooltip };

      if (key === "finalize") return { ...base, state: "Acordado", content: "", proposedBy: null };

      // conteúdo novo (ou tópico novo) = proposta de quem enviou
      if (!before || content !== (before.content ?? "").trim()) {
        return { ...base, content, state: wanted === "Negado" ? "Negado" : "Pendente", proposedBy: role };
      }
      if (wanted === "Acordado" && before.state !== "Acordado") {
        if (!content) throw new HttpError(400, `Preencha "${base.label}" antes de marcar como acordado`);
        if (!before.proposedBy || before.proposedBy === role) {
          throw new HttpError(403, `"${base.label}" foi proposto por você — aguarde a outra parte aceitar`);
        }
      }
      return { ...base, content, state: wanted, proposedBy: before.proposedBy ?? null };
    });

    n.clientAcceptedAt = null;
    n.providerAcceptedAt = null;
    await this.negotiationRepository.save(n);
    if (note) {
      await this.messageRepository.save(
        this.messageRepository.create({ conversation: { id: conv.id }, sender: { id: userId }, role: role as MessageRole, text: note.slice(0, 1000), negotiation: { id: n.id }, event: "negotiation.topic" })
      );
      await this.touch(conv.id, undefined, role);
      await notificationService.notify(
        this.otherUserId(conv, userId),
        { type: "topics.changed", title: `Atualização na negociação: ${n.title || "serviço"}`, body: note.slice(0, 200), link: `/negotiation/${conv.id}` },
        10
      );
    } else {
      await this.publishChange(conv);
    }
    return await this.summary(conv, userId, n.id);
  }

  /** Sem mensagem nova (o LiveSubscriber só avisa em mensagem): avisa as partes direto */
  private async publishChange(conv: Conversation) {
    publish([conv.client?.id, conv.provider?.user?.id], { type: "conversation", id: conv.id });
  }

  /**
   * Aceite final do acordo pela parte que chama. Quando cliente e prestador
   * aceitam, a contratação e o contrato são gerados e a negociação sai de cena.
   */
  async accept(id: number, userId: number, negotiationId?: number) {
    const conv = await this.load(id, userId);
    const n = await this.negotiationFor(conv, negotiationId);
    const topics = n.topics ?? defaultTopics(n.service);
    const pending = topics.filter((t) => t.state !== "Acordado");
    if (pending.length > 0) throw new HttpError(400, `Ainda falta acordar: ${pending.map((t) => t.label).join(", ")}`);
    const price = extractAmount(topics.find((t) => t.key === "payment")?.content ?? "");
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Informe um valor válido no tópico \"Valor & método\"");

    // o que mudou durante a negociação: serviço pausado, prestador fora do ar ou fechado sem data
    if (providerOffline(conv.provider)) throw new HttpError(400, OFFLINE_MESSAGE);
    if (n.service && n.service.active === false) throw new HttpError(400, "Este serviço foi pausado pelo prestador e não recebe pedidos no momento");
    const state = openState(conv.provider);
    if (!state.open && !state.closedUntil) throw new HttpError(400, closedMessage(state));

    const role = this.roleOf(conv, userId);
    const now = new Date();
    // Transação com a negociação travada: dois aceites ao mesmo tempo não geram dois contratos,
    // e contratação + contrato + mensagens entram juntos (ou nada entra).
    const result = await AppDataSource.transaction(async (m) => {
      const locked = await m.getRepository(Negotiation).findOne({ where: { id: n.id }, lock: { mode: "pessimistic_write" } });
      if (!locked || locked.status !== NegotiationStatus.OPEN) throw new HttpError(400, CLOSED);
      n.clientAcceptedAt = locked.clientAcceptedAt;
      n.providerAcceptedAt = locked.providerAcceptedAt;
      if (role === "cliente" && !n.clientAcceptedAt) {
        n.clientAcceptedAt = now;
        await this.system(conv, `${conv.client.name} aceitou o acordo de "${n.title}".`, m, n, "negotiation.accepted");
      }
      if (role === "prestador" && !n.providerAcceptedAt) {
        n.providerAcceptedAt = now;
        await this.system(conv, `${this.providerName(conv)} aceitou o acordo de "${n.title}".`, m, n, "negotiation.accepted");
      }
      await m.getRepository(Negotiation).update(n.id, { clientAcceptedAt: n.clientAcceptedAt, providerAcceptedAt: n.providerAcceptedAt });
      if (!n.clientAcceptedAt || !n.providerAcceptedAt) return null;
      return await this.formalize(conv, n, topics, price, m);
    });

    if (!result) {
      await notificationService.notify(this.otherUserId(conv, userId), {
        type: "agreement.accepted",
        title: `${this.nameOf(conv, userId)} aceitou o acordo`,
        body: `Falta o seu aceite em "${n.title || "negociação"}" para gerar o contrato.`,
        link: `/negotiation/${conv.id}`,
      });
      return { formalized: false as const, waitingFor: n.clientAcceptedAt ? "prestador" : "cliente", negotiationId: n.id };
    }
    if (n.service?.requiresScheduling) {
      await notificationService.notify(conv.client.id, {
        type: "hire.schedule.needed",
        title: "Escolha o horário do atendimento",
        body: `O acordo de "${n.title}" foi fechado. Marque o horário na agenda do prestador.`,
        link: "/hires",
      });
    }
    for (const target of [conv.client?.id, conv.provider?.user?.id]) {
      await notificationService.notify(target, {
        type: "contract.ready",
        title: `Contrato ${result.code} gerado`,
        body: `O acordo de "${n.title || "serviço"}" foi fechado. Assine o contrato.`,
        link: `/contract/${result.contractId}`,
      });
    }
    return { formalized: true as const, negotiationId: n.id, ...result };
  }

  /** Cria a contratação e o contrato a partir dos tópicos acordados. */
  private async formalize(conv: Conversation, n: Negotiation, topics: NegotiationTopic[], price: number, m: EntityManager) {
    const hires = m.getRepository(Hire);
    const contracts = m.getRepository(Contract);
    const get = (k: string) => topics.find((t) => t.key === k)?.content?.trim() ?? "";
    const description = (get("service") || n.title || n.service?.title || "Serviço negociado").slice(0, 100);
    const now = new Date();

    const hire = await hires.save(
      hires.create({
        price,
        description_service: description,
        firstContact: now,
        user: { id: conv.client.id },
        provider: { id: conv.provider.id },
        service: n.service ? { id: n.service.id } : undefined,
        // o acordo já foi aceito pelas duas partes: o pedido nasce aceito
        status_provider: StatusEnum.ACEITO,
        acceptedAt: now,
        paymentRequired: true,
        // presencial (ou sob medida sem serviço online): atende no endereço do cliente
        serviceAddress: !n.service?.online ? await profileAddress(conv.client.id) : null,
        // serviço com agenda: a duração acordada ocupa a agenda; o cliente escolhe o horário depois (RN05)
        durationMinutes: n.service?.requiresScheduling ? durationMinutes(get("duration") || n.service.duration) : null,
      })
    );

    const contract = await contracts.save(
      contracts.create({
        code: `HIRE-${now.getFullYear()}-${String(hire.id).padStart(5, "0")}`,
        price,
        description_service: description,
        firstContact: n.createdAt,
        lastContact: now,
        provider: { id: conv.provider.id },
        hire: { id: hire.id },
        user: { id: conv.client.id },
      })
    );

    n.status = NegotiationStatus.FORMALIZED;
    n.hire = hire;
    n.contract = contract;
    await m.getRepository(Negotiation).update(n.id, { status: NegotiationStatus.FORMALIZED, hire: { id: hire.id }, contract: { id: contract.id } });
    await this.system(conv, `Acordo fechado: contrato ${contract.code} gerado para "${n.title}".`, m, n, "negotiation.formalized");
    await this.system(
      conv,
      n.service?.requiresScheduling
        ? "Próximos passos: o cliente paga e escolhe o horário na agenda do serviço, em Minhas contratações. A conversa continua aberta."
        : "Próximo passo: o cliente faz o pagamento em Minhas contratações. A conversa continua aberta.",
      m
    );
    return { hireId: hire.id, contractId: contract.id, code: contract.code };
  }

  private async attach(conv: Conversation, userId: number, role: Party, files: Express.Multer.File[], n?: Negotiation) {
    for (const file of files) {
      await this.messageRepository.save(
        this.messageRepository.create({
          conversation: { id: conv.id },
          sender: { id: userId },
          role: role as MessageRole,
          text: "Arquivo enviado",
          attachmentUrl: privateRef(file.filename),
          attachmentName: file.originalname,
          negotiation: n ? { id: n.id } : null,
        })
      );
    }
    if (files.length) await this.touch(conv.id, undefined, role);
  }

  /** Pedido do cliente: nova negociação com a proposta dele nos tópicos (nunca sobrescreve outra) */
  private async openRequest(conv: Conversation, userId: number, target: Service | null, data: Partial<QuoteRequest>, files: Express.Multer.File[]) {
    const description = String(data.description ?? "").trim();
    const budget = String(data.budget ?? "").trim();
    if (!description) throw new HttpError(400, "Descreva o serviço desejado");
    if (!budget) throw new HttpError(400, "Informe o orçamento");
    if (!openState(conv.provider).open) throw new HttpError(400, closedMessage(openState(conv.provider)));

    const request: QuoteRequest = {
      description: description.slice(0, 500),
      budget: budget.slice(0, 100),
      date: String(data.date ?? "").slice(0, 20),
      notes: String(data.notes ?? "").trim().slice(0, 1000),
    };
    const byClient = (content: string) => ({ content, state: "Pendente" as const, proposedBy: "cliente" as const });

    // negociação do mesmo serviço aberta e ainda intocada (só "Negociar" clicado): vira o pedido
    const untouched = target
      ? await this.negotiationRepository.findOne({
          where: { conversation: { id: conv.id }, service: { id: target.id }, status: NegotiationStatus.OPEN, requestStatus: IsNull() },
          relations: this.negRelations,
        })
      : null;
    const pristine = untouched && !(untouched.topics ?? []).some((t) => t.proposedBy === "cliente") && !untouched.clientAcceptedAt && !untouched.providerAcceptedAt;

    const n = pristine
      ? untouched!
      : this.negotiationRepository.create({ conversation: { id: conv.id }, service: target ? { id: target.id } : null, origin: "pedido" as NegotiationOrigin, createdBy: "cliente" as Party, topics: defaultTopics(target) });
    n.origin = "pedido";
    n.title = (target?.title ?? request.description).slice(0, 120);
    n.topics = (n.topics ?? defaultTopics(target)).map((t) => {
      if (t.key === "service") return { ...t, ...byClient(request.description) };
      if (t.key === "payment") return { ...t, ...byClient(request.budget) };
      if (t.key === "start" && request.date) return { ...t, ...byClient(request.date) };
      return t;
    });
    n.request = request;
    n.requestStatus = RequestStatus.PENDENTE;
    n.rejectReason = null;
    await this.negotiationRepository.save(n);

    await this.system(conv, `Pedido de orçamento: ${n.title} (orçamento ${request.budget}).`, undefined, n, "negotiation.opened");
    // convite de cliente convertido: primeiro pedido feito
    await inviteService.markConverted(userId, "client").catch(() => null);
    await notificationService.notify(conv.provider?.user?.id, {
      type: "quote.requested",
      title: `Pedido de orçamento: ${target?.title ?? "outro serviço"}`,
      body: `${conv.client?.name ?? "Um cliente"}: ${request.description.slice(0, 120)} (orçamento ${request.budget})`,
      link: `/negotiation/${conv.id}`,
    });
    if (request.notes) {
      await this.messageRepository.save(
        this.messageRepository.create({ conversation: { id: conv.id }, sender: { id: userId }, role: MessageRole.CLIENT, text: request.notes, negotiation: { id: n.id } })
      );
      await this.touch(conv.id, undefined, "cliente");
    }
    await this.attach(conv, userId, "cliente", files, n);
    return n;
  }

  /** Pedido de orçamento (modal "Orçamento"): abre a conversa do par e uma negociação nova */
  async request(userId: number, data: { serviceId?: number | string; providerId?: number | string } & Partial<QuoteRequest>, files: Express.Multer.File[] = []) {
    if (!String(data.description ?? "").trim()) throw new HttpError(400, "Descreva o serviço desejado");
    if (!String(data.budget ?? "").trim()) throw new HttpError(400, "Informe o orçamento");
    // pedido para um serviço publicado ou, em "Outros", direto ao prestador (serviço que ele não listou)
    if (!data.serviceId && !data.providerId) throw new HttpError(400, "Serviço não informado");
    const target = data.serviceId ? await this.serviceRepository.findOne({ where: { id: Number(data.serviceId) }, relations: { provider: true } }) : null;
    if (data.serviceId && !target) throw new HttpError(404, "Serviço não encontrado");
    if (target && target.active === false) throw new HttpError(400, "Este serviço está pausado pelo prestador e não recebe pedidos no momento");
    const provider = await this.providerOr404(Number(target?.provider?.id ?? data.providerId));
    if (providerOffline(provider)) throw new HttpError(400, OFFLINE_MESSAGE);
    if (provider.user?.id === userId) throw new HttpError(400, "Você não pode negociar com o seu próprio perfil");

    const conv = await this.pair(userId, provider.id);
    const n = await this.openRequest(conv, userId, target, data, files);
    return await this.summary(conv, userId, n.id);
  }

  /** Resposta do prestador ao pedido: a proposta dele substitui os tópicos correspondentes. */
  async respond(id: number, userId: number, data: { title?: string; description?: string; price?: string; deadline?: string }, files: Express.Multer.File[] = [], negotiationId?: number) {
    const conv = await this.load(id, userId);
    if (this.roleOf(conv, userId) !== "prestador") throw new HttpError(403, "Só o prestador responde ao pedido");
    const n = await this.negotiationFor(conv, negotiationId);

    const title = String(data.title ?? "").trim();
    const description = String(data.description ?? "").trim();
    const price = String(data.price ?? "").trim();
    const deadline = String(data.deadline ?? "").trim();
    if (!description || !price) throw new HttpError(400, "Informe descrição e preço da proposta");

    const byProvider = (content: string) => ({ content: content.slice(0, 500), state: "Pendente" as const, proposedBy: "prestador" as const });
    n.topics = (n.topics ?? defaultTopics(n.service)).map((t) => {
      if (t.key === "service") return { ...t, ...byProvider(title ? `${title} — ${description}` : description) };
      if (t.key === "payment") return { ...t, ...byProvider(price) };
      if (t.key === "duration" && deadline) return { ...t, ...byProvider(deadline) };
      return t;
    });
    n.requestStatus = RequestStatus.RESPONDIDA;
    n.clientAcceptedAt = null;
    n.providerAcceptedAt = null;
    await this.negotiationRepository.save(n);

    const lines = [`Proposta: ${title || n.title || "serviço"}`, description, `Preço: ${price}`, deadline ? `Prazo: ${deadline}` : ""].filter(Boolean);
    await this.messageRepository.save(
      this.messageRepository.create({ conversation: { id: conv.id }, sender: { id: userId }, role: MessageRole.PROVIDER, text: lines.join("\n").slice(0, 1000), negotiation: { id: n.id }, event: "negotiation.proposal" })
    );
    await this.touch(conv.id, undefined, "prestador");
    await this.attach(conv, userId, "prestador", files, n);
    await notificationService.notify(conv.client?.id, {
      type: "quote.responded",
      title: `Proposta recebida: ${n.title || "serviço"}`,
      body: `${this.nameOf(conv, userId)} respondeu: ${price}${deadline ? ` · ${deadline}` : ""}`,
      link: `/negotiation/${conv.id}`,
    });
    return await this.summary(conv, userId, n.id);
  }

  /** Recusa do pedido pelo prestador, com motivo opcional. Encerra só a negociação. */
  async reject(id: number, userId: number, reason?: string, negotiationId?: number) {
    const conv = await this.load(id, userId);
    if (this.roleOf(conv, userId) !== "prestador") throw new HttpError(403, "Só o prestador recusa o pedido");
    const n = await this.negotiationFor(conv, negotiationId);
    const clean = String(reason ?? "").trim().slice(0, 500);
    n.requestStatus = RequestStatus.RECUSADA;
    n.rejectReason = clean || null;
    n.status = NegotiationStatus.CLOSED;
    n.closedBy = "prestador";
    await this.negotiationRepository.save(n);
    await this.system(conv, `Pedido recusado pelo prestador: "${n.title}".${clean ? ` Motivo: ${clean}` : ""}`, undefined, n, "negotiation.rejected");
    await notificationService.notify(conv.client?.id, {
      type: "quote.rejected",
      title: `Pedido recusado: ${n.title || "serviço"}`,
      body: clean ? `Motivo: ${clean}` : `${this.nameOf(conv, userId)} não pode atender este pedido.`,
      link: `/negotiation/${conv.id}`,
    });
    return await this.summary(conv, userId, n.id);
  }

  /**
   * Encerra a negociação sem acordo, com motivo opcional. A conversa continua.
   * Quando o cliente encerra depois de receber a proposta, conta como proposta recusada.
   */
  async close(id: number, userId: number, reason?: unknown, negotiationId?: number) {
    const conv = await this.load(id, userId);
    const n = await this.negotiationFor(conv, negotiationId, false);
    if (n.status !== NegotiationStatus.OPEN) return await this.summary(conv, userId, n.id);
    const role = this.roleOf(conv, userId) as Party;
    const clean = String(reason ?? "").trim().slice(0, 500);
    const proposalRejected = role === "cliente" && n.requestStatus === RequestStatus.RESPONDIDA;
    n.status = NegotiationStatus.CLOSED;
    n.closedBy = role;
    n.closeReason = clean || null;
    await this.negotiationRepository.save(n);
    await this.system(conv, `${proposalRejected ? "Proposta recusada pelo cliente" : "Negociação encerrada"}: "${n.title}".${clean ? ` Motivo: ${clean}` : ""}`, undefined, n, "negotiation.closed");
    await notificationService.notify(this.otherUserId(conv, userId), {
      type: proposalRejected ? "quote.declined" : "negotiation.closed",
      title: `${proposalRejected ? "Proposta recusada" : "Negociação encerrada"}: ${n.title || "serviço"}`,
      body: `${this.nameOf(conv, userId)} ${proposalRejected ? "recusou sua proposta" : "encerrou a negociação"}.${clean ? ` Motivo: ${clean}` : ""}`,
      link: `/negotiation/${conv.id}`,
    });
    return await this.summary(conv, userId, n.id);
  }
}
