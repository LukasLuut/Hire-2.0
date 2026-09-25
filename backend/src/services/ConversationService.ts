import { AppDataSource } from "../config/data-source";
import { Conversation, ConversationStatus, NegotiationTopic } from "../models/Conversation";
import { Message, MessageRole } from "../models/Message";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { Hire } from "../models/Hire";
import { Contract } from "../models/Contract";

// Mesmos tópicos iniciais do modal de negociação do frontend
function defaultTopics(service?: Service | null): NegotiationTopic[] {
  return [
    { key: "service", label: "Serviço previsto", tooltip: "Descrição e escopo do serviço (o que será entregue).", state: "Pendente", content: service?.title ?? "" },
    { key: "payment", label: "Valor & método", tooltip: "Valor acordado e forma de pagamento.", state: "Pendente", content: service ? String(service.price).replace(".", ",") : "" },
    { key: "start", label: "Data e hora de início", tooltip: "Defina quando o serviço deve começar.", state: "Pendente", content: "" },
    { key: "duration", label: "Duração", tooltip: "Tempo estimado para entrega / realização do serviço.", state: "Pendente", content: service?.duration ?? "" },
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
      hireId: conv.hire?.id ?? null,
      contractId: conv.contract?.id ?? null,
      updatedAt: conv.updatedAt,
      lastMessage: last ? { text: last.text, role: last.role, createdAt: last.createdAt } : null,
    };
  }

  private async load(id: number, userId: number) {
    const conv = await this.conversationRepository.findOne({ where: { id }, relations: this.relations });
    if (!conv) throw new Error("Conversa não encontrada");
    if (!this.roleOf(conv, userId)) throw new Error("Você não participa desta conversa");
    return conv;
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
        attachmentUrl: m.attachmentUrl,
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
        attachmentUrl: file ? `/uploads/${file.filename}` : null,
        attachmentName: file ? file.originalname : null,
      })
    );
    await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
    return message.id;
  }

  /** Atualiza os tópicos e registra a alteração no chat. */
  async updateTopics(id: number, userId: number, topics: NegotiationTopic[], note?: string) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) throw new Error("Esta negociação já foi encerrada");
    if (!Array.isArray(topics)) throw new Error("Tópicos inválidos");
    conv.topics = topics.map((t) => ({
      key: String(t.key),
      label: String(t.label),
      tooltip: t.tooltip,
      state: t.state === "Acordado" || t.state === "Negado" ? t.state : "Pendente",
      content: String(t.content ?? "").slice(0, 500),
    }));
    await this.conversationRepository.save(conv);
    if (note) {
      await this.messageRepository.save(
        this.messageRepository.create({ conversation: conv, sender: { id: userId }, role: this.roleOf(conv, userId)!, text: note.slice(0, 1000) })
      );
    }
    return this.present(conv, userId);
  }

  /** Formaliza: cria a contratação e o contrato a partir dos tópicos acordados. */
  async formalize(id: number, userId: number) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) throw new Error("Esta negociação já foi encerrada");
    const topics = conv.topics ?? defaultTopics(conv.service);
    const pending = topics.filter((t) => t.state !== "Acordado");
    if (pending.length > 0) throw new Error(`Ainda falta acordar: ${pending.map((t) => t.label).join(", ")}`);

    const get = (k: string) => topics.find((t) => t.key === k)?.content?.trim() ?? "";
    const price = extractAmount(get("payment"));
    if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um valor válido no tópico \"Valor & método\"");

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
    return { hireId: hire.id, contractId: contract.id, code: contract.code };
  }

  async close(id: number, userId: number) {
    const conv = await this.load(id, userId);
    if (conv.status !== ConversationStatus.OPEN) return this.present(conv, userId);
    conv.status = ConversationStatus.CLOSED;
    await this.conversationRepository.save(conv);
    await this.system(conv, "Negociação encerrada ✖️");
    return this.present(conv, userId);
  }
}
