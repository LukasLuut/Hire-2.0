import { AppDataSource } from "../config/data-source";
import { fileUrl, privateRef } from "../utils/signedFile";
import { durationMinutes } from "../utils/schedule";
import { OFFLINE_MESSAGE, providerOffline } from "../utils/availability";
import { closedMessage, openState } from "../utils/openStatus";
import { inviteService } from "./InviteService";
import { Conversation, ConversationStatus, NegotiationTopic, QuoteRequest, RequestStatus } from "../models/Conversation";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";
import { Message, MessageRole } from "../models/Message";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { Hire, StatusEnum } from "../models/Hire";
import { Contract } from "../models/Contract";

// Mesmos tópicos iniciais do modal de negociação do frontend
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
function extractAmount(text: string): number {
  const match = text.replace(/\s/g, "").match(/\d[\d.]*(,\d{1,2})?|\d+(\.\d{1,2})?/);
  if (!match) return NaN;
  const raw = match[0];
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

export class ConversationService {
  private conversationRepository = AppDataSource.getRepository(Conversation);
  private messageRepository = AppDataSource.getRepository(Message);
  private providerRepository = AppDataSource.getRepository(ServiceProvider);
  private serviceRepository = AppDataSource.getRepository(Service);
  private hireRepository = AppDataSource.getRepository(Hire);
  private contractRepository = AppDataSource.getRepository(Contract);

  private readonly relations = { client: true, provider: { user: true }, service: true, hire: true, contract: true } as const;

  private roleOf(conv: Conversation, userId: number): MessageRole | null {
    if (conv.client?.id === userId) return MessageRole.CLIENT;
    if (conv.provider?.user?.id === userId) return MessageRole.PROVIDER;
    return null;
  }

  private present(conv: Conversation, userId: number, last?: Message | null) {
    const role = this.roleOf(conv, userId);
    return {
      id: conv.id,
      status: conv.status,
      topics: conv.topics ?? defaultTopics(conv.service),
      myRole: role,
      client: conv.client ? { id: conv.client.id, name: conv.client.name } : null,
      provider: conv.provider
        ? {
            id: conv.provider.id,
            companyName: conv.provider.companyName,
            professionalName: conv.provider.professionalName,
            profileImageUrl: conv.provider.profileImageUrl,
            userId: conv.provider.user?.id,
          }
        : null,
      service: conv.service ? { id: conv.service.id, title: conv.service.title, price: conv.service.price, duration: conv.service.duration, description: conv.service.description_service } : null,
      request: conv.request ?? null,
      requestStatus: conv.requestStatus ?? null,
      rejectReason: conv.rejectReason ?? null,
      clientAcceptedAt: conv.clientAcceptedAt ?? null,
      providerAcceptedAt: conv.providerAcceptedAt ?? null,
      hireId: conv.hire?.id ?? null,
      contractId: conv.contract?.id ?? null,
      updatedAt: conv.updatedAt,
      lastMessage: last ? { text: last.text, role: last.role, createdAt: last.createdAt } : null,
    };
  }

  private async load(id: number, userId: number) {
    const conv = await this.conversationRepository.findOne({ where: { id }, relations: this.relations });
    if (!conv) throw new HttpError(404, "Conversa não encontrada");
    if (!this.roleOf(conv, userId)) throw new HttpError(403, "Você não participa desta conversa");
    return conv;
  }

  /** id do usuário da outra parte */
  private otherUserId(conv: Conversation, userId: number) {
    return conv.client?.id === userId ? conv.provider?.user?.id : conv.client?.id;
  }

  private nameOf(conv: Conversation, userId: number) {
    return conv.client?.id === userId ? conv.client?.name ?? "O cliente" : conv.provider?.companyName || conv.provider?.professionalName || "O prestador";
  }

  private async system(conv: Conversation, text: string) {
    await this.messageRepository.save(this.messageRepository.create({ conversation: conv, role: MessageRole.SYSTEM, text, sender: null }));
  }

  /** Abre (ou reaproveita) a conversa aberta entre o cliente e o prestador sobre um serviço. */
  async open(userId: number, data: { providerId?: number | string; serviceId?: number | string }) {
    let service: Service | null = null;
    if (data.serviceId) {
      service = await this.serviceRepository.findOne({ where: { id: Number(data.serviceId) }, relations: { provider: true } });
      if (!service) throw new Error("Serviço não encontrado");
    }
    const providerId = Number(data.providerId ?? service?.provider?.id);
    const provider = await this.providerRepository.findOne({ where: { id: providerId }, relations: { user: true } });
    if (!provider) throw new Error("Prestador não encontrado");
    if (providerOffline(provider)) throw new HttpError(400, OFFLINE_MESSAGE);
    if (provider.user?.id === userId) throw new Error("Você não pode negociar com o seu próprio perfil");

    const existing = await this.conversationRepository.findOne({
      where: {
        client: { id: userId },
        provider: { id: provider.id },
        status: ConversationStatus.OPEN,
        ...(service ? { service: { id: service.id } } : {}),
      },
      relations: this.relations,
      order: { updatedAt: "DESC" },
    });
    if (existing) return this.present(existing, userId);

    const conv = await this.conversationRepository.save(
      this.conversationRepository.create({
        client: { id: userId },
        provider: { id: provider.id },
        service: service ? { id: service.id } : null,
        topics: defaultTopics(service),
      })
    );
    await this.system(conv, "Inicie a negociação ajustando os tópicos.");
    return this.present(await this.load(conv.id, userId), userId);
  }

  /** Conversas em que o usuário participa (como cliente ou prestador). */
  async listMine(userId: number) {
    const convs = await this.conversationRepository.find({
      where: [{ client: { id: userId } }, { provider: { user: { id: userId } } }],
      relations: this.relations,
      order: { updatedAt: "DESC" },
    });
    return Promise.all(
      convs.map(async (c) => {
        const last = await this.messageRepository.findOne({ where: { conversation: { id: c.id } }, order: { id: "DESC" } });
        return this.present(c, userId, last);
      })
    );
  }

  async get(id: number, userId: number, afterId?: number) {
    const conv = await this.load(id, userId);
    const qb = this.messageRepository
      .createQueryBuilder("m")
      .leftJoin("m.sender", "s")
      .addSelect(["s.id", "s.name"])
      .where("m.conversationId = :id", { id })
      .orderBy("m.id", "ASC");
    if (afterId) qb.andWhere("m.id > :afterId", { afterId });
    const messages = await qb.getMany();
    return {
      ...this.present(conv, userId),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachmentUrl: fileUrl(m.attachmentUrl),
        attachmentName: m.attachmentName,
        createdAt: m.createdAt,
        sender: m.sender ? { id: m.sender.id, name: m.sender.name } : null,
      })),
    };
  }

  async sendMessage(id: number, userId: number, text: string, file?: Express.Multer.File) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) throw new Error("Esta negociação já foi encerrada");
    const clean = (text ?? "").trim();
    if (!clean && !file) throw new Error("Escreva uma mensagem ou anexe um arquivo");
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        conversation: conv,
        sender: { id: userId },
        role: this.roleOf(conv, userId)!,
        text: clean || (file ? "Arquivo enviado" : ""),
        attachmentUrl: file ? privateRef(file.filename) : null,
        attachmentName: file ? file.originalname : null,
      })
    );
    await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
    await notificationService.notify(
      this.otherUserId(conv, userId),
      { type: "message", title: `Nova mensagem de ${this.nameOf(conv, userId)}`, body: message.text.slice(0, 140), link: `/negotiation/${conv.id}` },
      30
    );
    return message.id;
  }

  /**
   * Atualiza os tópicos com consentimento mútuo:
   * - mudar o conteúdo vira uma proposta de quem mudou (fica Pendente);
   * - só a outra parte pode marcar uma proposta como Acordado;
   * - qualquer mudança desfaz os aceites finais do acordo.
   */
  async updateTopics(id: number, userId: number, topics: NegotiationTopic[], note?: string) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) throw new HttpError(400, "Esta negociação já foi encerrada");
    if (!Array.isArray(topics) || topics.length > 10) throw new HttpError(400, "Tópicos inválidos");
    const role = this.roleOf(conv, userId) as "cliente" | "prestador";
    const previous = new Map((conv.topics ?? defaultTopics(conv.service)).map((t) => [t.key, t]));

    conv.topics = topics.map((t): NegotiationTopic => {
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

    conv.clientAcceptedAt = null;
    conv.providerAcceptedAt = null;
    await this.conversationRepository.save(conv);
    if (note) {
      await this.messageRepository.save(
        this.messageRepository.create({ conversation: conv, sender: { id: userId }, role: role as MessageRole, text: note.slice(0, 1000) })
      );
      await notificationService.notify(
        this.otherUserId(conv, userId),
        { type: "topics.changed", title: `Atualização na negociação: ${conv.service?.title ?? "serviço"}`, body: note.slice(0, 200), link: `/negotiation/${conv.id}` },
        10
      );
    }
    return this.present(conv, userId);
  }

  /**
   * Aceite final do acordo pela parte que chama. Quando cliente e prestador
   * aceitam, a contratação e o contrato são gerados.
   */
  async accept(id: number, userId: number) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) throw new HttpError(400, "Esta negociação já foi encerrada");
    const topics = conv.topics ?? defaultTopics(conv.service);
    const pending = topics.filter((t) => t.state !== "Acordado");
    if (pending.length > 0) throw new HttpError(400, `Ainda falta acordar: ${pending.map((t) => t.label).join(", ")}`);
    const price = extractAmount(topics.find((t) => t.key === "payment")?.content ?? "");
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Informe um valor válido no tópico \"Valor & método\"");

    // o que mudou durante a negociação: serviço pausado, prestador fora do ar ou fechado sem data
    if (providerOffline(conv.provider)) throw new HttpError(400, OFFLINE_MESSAGE);
    if (conv.service && conv.service.active === false) throw new HttpError(400, "Este serviço foi pausado pelo prestador e não recebe pedidos no momento");
    const state = openState(conv.provider);
    if (!state.open && !state.closedUntil) throw new HttpError(400, closedMessage(state));

    const role = this.roleOf(conv, userId);
    const now = new Date();
    if (role === MessageRole.CLIENT && !conv.clientAcceptedAt) {
      conv.clientAcceptedAt = now;
      await this.system(conv, `${conv.client.name} aceitou o acordo.`);
    }
    if (role === MessageRole.PROVIDER && !conv.providerAcceptedAt) {
      conv.providerAcceptedAt = now;
      await this.system(conv, `${conv.provider.companyName || conv.provider.professionalName} aceitou o acordo.`);
    }
    await this.conversationRepository.save(conv);

    if (!conv.clientAcceptedAt || !conv.providerAcceptedAt) {
      await notificationService.notify(this.otherUserId(conv, userId), {
        type: "agreement.accepted",
        title: `${this.nameOf(conv, userId)} aceitou o acordo`,
        body: `Falta o seu aceite em "${conv.service?.title ?? "negociação"}" para gerar o contrato.`,
        link: `/negotiation/${conv.id}`,
      });
      return { formalized: false as const, waitingFor: conv.clientAcceptedAt ? "prestador" : "cliente" };
    }
    const result = await this.formalize(conv, topics, price);
    for (const target of [conv.client?.id, conv.provider?.user?.id]) {
      await notificationService.notify(target, {
        type: "contract.ready",
        title: `Contrato ${result.code} gerado`,
        body: `O acordo de "${conv.service?.title ?? "serviço"}" foi fechado. Assine o contrato.`,
        link: `/contract/${result.contractId}`,
      });
    }
    return { formalized: true as const, ...result };
  }

  /** Cria a contratação e o contrato a partir dos tópicos acordados. */
  private async formalize(conv: Conversation, topics: NegotiationTopic[], price: number) {
    const get = (k: string) => topics.find((t) => t.key === k)?.content?.trim() ?? "";
    const description = (get("service") || conv.service?.title || "Serviço negociado").slice(0, 100);
    const now = new Date();

    const hire = await this.hireRepository.save(
      this.hireRepository.create({
        price,
        description_service: description,
        firstContact: now,
        user: { id: conv.client.id },
        provider: { id: conv.provider.id },
        service: conv.service ? { id: conv.service.id } : undefined,
        // o acordo já foi aceito pelas duas partes: o pedido nasce aceito
        status_provider: StatusEnum.ACEITO,
        acceptedAt: now,
        paymentRequired: true,
        // serviço com agenda: a duração acordada ocupa a agenda; o cliente escolhe o horário depois (RN05)
        durationMinutes: conv.service?.requiresScheduling ? durationMinutes(get("duration") || conv.service.duration) : null,
      })
    );

    const contract = await this.contractRepository.save(
      this.contractRepository.create({
        code: `HIRE-${now.getFullYear()}-${String(hire.id).padStart(5, "0")}`,
        price,
        description_service: description,
        firstContact: conv.createdAt,
        lastContact: now,
        provider: { id: conv.provider.id },
        hire: { id: hire.id },
        user: { id: conv.client.id },
      })
    );

    conv.status = ConversationStatus.FORMALIZED;
    conv.hire = hire;
    conv.contract = contract;
    await this.conversationRepository.save(conv);
    await this.system(conv, `Serviço formalizado ✔️ Contrato ${contract.code} gerado.`);
    if (!conv.service?.requiresScheduling) await this.system(conv, "Próximo passo: o cliente faz o pagamento em Minhas contratações.");
    if (conv.service?.requiresScheduling) {
      await this.system(conv, "Próximos passos: o cliente paga e escolhe o horário na agenda do serviço, em Minhas contratações.");
      await notificationService.notify(conv.client.id, {
        type: "hire.schedule.needed",
        title: "Escolha o horário do atendimento",
        body: `O acordo de "${conv.service.title}" foi fechado. Marque o horário na agenda do prestador.`,
        link: "/hires",
      });
    }
    return { hireId: hire.id, contractId: contract.id, code: contract.code };
  }

  private async attach(conv: Conversation, userId: number, role: MessageRole, files: Express.Multer.File[]) {
    for (const file of files) {
      await this.messageRepository.save(
        this.messageRepository.create({
          conversation: conv,
          sender: { id: userId },
          role,
          text: "Arquivo enviado",
          attachmentUrl: privateRef(file.filename),
          attachmentName: file.originalname,
        })
      );
    }
  }

  /** Pedido de orçamento do cliente: abre a negociação já com a proposta dele nos tópicos. */
  async request(userId: number, data: { serviceId?: number | string } & Partial<QuoteRequest>, files: Express.Multer.File[] = []) {
    const description = String(data.description ?? "").trim();
    const budget = String(data.budget ?? "").trim();
    if (!description) throw new HttpError(400, "Descreva o serviço desejado");
    if (!budget) throw new HttpError(400, "Informe o orçamento");
    if (!data.serviceId) throw new HttpError(400, "Serviço não informado");
    const target = await this.serviceRepository.findOne({ where: { id: Number(data.serviceId) } });
    if (target && target.active === false) throw new HttpError(400, "Este serviço está pausado pelo prestador e não recebe pedidos no momento");
    const targetProvider = target ? await this.providerRepository.findOne({ where: { services: { id: target.id } } }) : null;
    if (targetProvider && !openState(targetProvider).open) throw new HttpError(400, closedMessage(openState(targetProvider)));

    const summary = await this.open(userId, { serviceId: data.serviceId });
    const conv = await this.load(summary.id, userId);
    const request: QuoteRequest = {
      description: description.slice(0, 500),
      budget: budget.slice(0, 100),
      date: String(data.date ?? "").slice(0, 20),
      notes: String(data.notes ?? "").trim().slice(0, 1000),
    };
    const byClient = (content: string) => ({ content, state: "Pendente" as const, proposedBy: "cliente" as const });
    conv.topics = (conv.topics ?? defaultTopics(conv.service)).map((t) => {
      if (t.key === "service") return { ...t, ...byClient(request.description) };
      if (t.key === "payment") return { ...t, ...byClient(request.budget) };
      if (t.key === "start" && request.date) return { ...t, ...byClient(request.date) };
      return t;
    });
    conv.request = request;
    conv.requestStatus = RequestStatus.PENDENTE;
    conv.rejectReason = null;
    conv.clientAcceptedAt = null;
    conv.providerAcceptedAt = null;
    await this.conversationRepository.save(conv);

    await this.system(conv, "Pedido de orçamento enviado ao prestador.");
    // convite de cliente convertido: primeiro pedido feito
    await inviteService.markConverted(userId, "client").catch(() => null);
    await notificationService.notify(conv.provider?.user?.id, {
      type: "quote.requested",
      title: `Pedido de orçamento: ${conv.service?.title ?? "serviço"}`,
      body: `${conv.client?.name ?? "Um cliente"}: ${request.description.slice(0, 120)} (orçamento ${request.budget})`,
      link: "/business",
    });
    if (request.notes) {
      await this.messageRepository.save(
        this.messageRepository.create({ conversation: conv, sender: { id: userId }, role: MessageRole.CLIENT, text: request.notes })
      );
    }
    await this.attach(conv, userId, MessageRole.CLIENT, files);
    return this.present(conv, userId);
  }

  /** Resposta do prestador ao pedido: a proposta dele substitui os tópicos correspondentes. */
  async respond(id: number, userId: number, data: { title?: string; description?: string; price?: string; deadline?: string }, files: Express.Multer.File[] = []) {
    const conv = await this.load(id, userId);
    if (this.roleOf(conv, userId) !== MessageRole.PROVIDER) throw new HttpError(403, "Só o prestador responde ao pedido");
    if (conv.status !== ConversationStatus.OPEN) throw new HttpError(400, "Esta negociação já foi encerrada");

    const title = String(data.title ?? "").trim();
    const description = String(data.description ?? "").trim();
    const price = String(data.price ?? "").trim();
    const deadline = String(data.deadline ?? "").trim();
    if (!description || !price) throw new HttpError(400, "Informe descrição e preço da proposta");

    const byProvider = (content: string) => ({ content: content.slice(0, 500), state: "Pendente" as const, proposedBy: "prestador" as const });
    conv.topics = (conv.topics ?? defaultTopics(conv.service)).map((t) => {
      if (t.key === "service") return { ...t, ...byProvider(title ? `${title} — ${description}` : description) };
      if (t.key === "payment") return { ...t, ...byProvider(price) };
      if (t.key === "duration" && deadline) return { ...t, ...byProvider(deadline) };
      return t;
    });
    conv.requestStatus = RequestStatus.RESPONDIDA;
    conv.clientAcceptedAt = null;
    conv.providerAcceptedAt = null;
    await this.conversationRepository.save(conv);

    const lines = [`Proposta: ${title || "serviço"}`, description, `Preço: ${price}`, deadline ? `Prazo: ${deadline}` : ""].filter(Boolean);
    await this.messageRepository.save(
      this.messageRepository.create({ conversation: conv, sender: { id: userId }, role: MessageRole.PROVIDER, text: lines.join("\n").slice(0, 1000) })
    );
    await this.attach(conv, userId, MessageRole.PROVIDER, files);
    await notificationService.notify(conv.client?.id, {
      type: "quote.responded",
      title: `Proposta recebida: ${conv.service?.title ?? "serviço"}`,
      body: `${this.nameOf(conv, userId)} respondeu: ${price}${deadline ? ` · ${deadline}` : ""}`,
      link: `/negotiation/${conv.id}`,
    });
    return this.present(conv, userId);
  }

  /** Recusa do pedido pelo prestador, com motivo opcional. Encerra a negociação. */
  async reject(id: number, userId: number, reason?: string) {
    const conv = await this.load(id, userId);
    if (this.roleOf(conv, userId) !== MessageRole.PROVIDER) throw new HttpError(403, "Só o prestador recusa o pedido");
    if (conv.status !== ConversationStatus.OPEN) throw new HttpError(400, "Esta negociação já foi encerrada");
    const clean = String(reason ?? "").trim().slice(0, 500);
    conv.requestStatus = RequestStatus.RECUSADA;
    conv.rejectReason = clean || null;
    conv.status = ConversationStatus.CLOSED;
    await this.conversationRepository.save(conv);
    await this.system(conv, `Pedido recusado pelo prestador.${clean ? ` Motivo: ${clean}` : ""}`);
    await notificationService.notify(conv.client?.id, {
      type: "quote.rejected",
      title: `Pedido recusado: ${conv.service?.title ?? "serviço"}`,
      body: clean ? `Motivo: ${clean}` : `${this.nameOf(conv, userId)} não pode atender este pedido.`,
      link: `/negotiation/${conv.id}`,
    });
    return this.present(conv, userId);
  }

  async close(id: number, userId: number) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) return this.present(conv, userId);
    conv.status = ConversationStatus.CLOSED;
    await this.conversationRepository.save(conv);
    await this.system(conv, "Negociação encerrada ✖️");
    await notificationService.notify(this.otherUserId(conv, userId), {
      type: "negotiation.closed",
      title: `Negociação encerrada: ${conv.service?.title ?? "serviço"}`,
      body: `${this.nameOf(conv, userId)} encerrou a negociação.`,
      link: `/negotiation/${conv.id}`,
    });
    return this.present(conv, userId);
  }
}
