import { AppDataSource } from "../config/data-source";
import { PaymentMethod } from "../models/Payment";
import { METHODS, paymentService } from "./PaymentService";
import { OFFLINE_MESSAGE, providerOffline } from "../utils/availability";
import { closedMessage, openState } from "../utils/openStatus";
import { inviteService } from "./InviteService";
import { Hire, StatusEnum, type ServiceAddress } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { durationMinutes, fitsSchedule, noticeHours, overlaps, parseLocalDateTime, withinBusinessHours, type BusinessHours } from "../utils/schedule";
import { Between, LessThan, Not } from "typeorm";
import { Availability } from "../models/Availability";
import { notificationService } from "./NotificationService";
import { statsService } from "./StatsService";
import { User } from "../models/User";

/** Endereço do cadastro do cliente (cópia para o pedido) */
export async function profileAddress(userId: number): Promise<ServiceAddress | null> {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, relations: { address: true } });
    const a = user?.address;
    if (!a?.street || !a.city) return null;
    return { street: a.street, num: String(a.num ?? ""), complement: null, neighborhood: a.neighborhood, city: a.city, state: a.state, postalCode: a.postalCode };
}

/** Endereço enviado pelo cliente: rua, número, bairro, cidade, UF e CEP obrigatórios */
function parseAddress(raw: unknown): ServiceAddress {
    const d = (raw ?? {}) as Record<string, unknown>;
    const s = (k: string, max = 100) => String(d[k] ?? "").trim().slice(0, max);
    const address: ServiceAddress = {
        street: s("street"), num: s("num", 20), complement: s("complement") || null, neighborhood: s("neighborhood"),
        city: s("city"), state: s("state", 2).toUpperCase(), postalCode: s("postalCode", 9).replace(/[^\d-]/g, ""),
    };
    if (!address.street || !address.num || !address.neighborhood || !address.city || address.state.length !== 2 || address.postalCode.replace(/\D/g, "").length !== 8) {
        throw new HttpError(400, "Informe o endereço completo: CEP, rua, número, bairro, cidade e UF");
    }
    return address;
}

/**
 * Privacidade: o prestador só vê o endereço completo depois de aceitar e enquanto o
 * atendimento está em aberto; antes (e depois de encerrado), só bairro e cidade.
 */
export function forViewer<T extends Hire | null>(hire: T, role: Role): T {
    if (!hire || role !== "provider" || !hire.serviceAddress) return hire;
    const open = !!hire.acceptedAt && hire.status === StatusEnum.PENDENTE && hire.status_provider !== StatusEnum.CANCELADO;
    if (open) return hire;
    const { neighborhood, city, state } = hire.serviceAddress;
    return { ...hire, serviceAddress: { street: "", num: "", neighborhood, city, state, postalCode: "" } } as T;
}

/** Erro com status HTTP, usado pelo controller para responder 403/404. */
export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

type Role = "client" | "provider";

export class HireService {
    private hireRepository = AppDataSource.getRepository(Hire);
    private providerRepository = AppDataSource.getRepository(ServiceProvider);
    private serviceRepository = AppDataSource.getRepository(Service);

    // Relações necessárias para exibir uma contratação completa no frontend
    private readonly fullRelations = { user: true, provider: true, service: { category: true, provider: true }, payment: true };

    /** Carrega a contratação com os donos de cada lado e diz qual papel o usuário tem nela. */
    private async loadWithRole(id: number, requesterId: number): Promise<{ hire: Hire; role: Role }> {
        const hire = await this.hireRepository.findOne({
            where: { id },
            relations: { user: true, provider: { user: true }, service: true, payment: true },
        });
        if (!hire) throw new HttpError(404, "Contratação não encontrada");
        if (hire.user?.id === requesterId) return { hire, role: "client" };
        if (hire.provider?.user?.id === requesterId) return { hire, role: "provider" };
        throw new HttpError(403, "Você não participa desta contratação");
    }

    async create(data: { price: number, description_service: string, firstContact: Date, serviceId: string, scheduledAt?: string, packageIndex?: unknown, quantity?: unknown }, userId: number) {
        const { description_service, firstContact, serviceId } = data;

        const service = await this.serviceRepository.findOne({
            where: { id: Number(serviceId) },
            relations: { provider: { user: true, availabilities: true } },
        });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        if (service.provider?.user?.id === userId) throw new HttpError(400, "Você não pode contratar o próprio serviço");
        if (service.active === false) throw new HttpError(400, "Este serviço está pausado pelo prestador e não recebe pedidos no momento");
        if (providerOffline(service.provider)) throw new HttpError(400, OFFLINE_MESSAGE);
        // fechado: aceita só agendamento para depois da data de reabertura
        const state = openState(service.provider);
        if (!state.open) {
            const when = parseLocalDateTime(data.scheduledAt);
            const afterReopen = !!state.closedUntil && !!when && when.getTime() >= state.closedUntil.getTime();
            if (!afterReopen) throw new HttpError(400, closedMessage(state));
        }

        // Preço: "a partir de" e "sob orçamento" pedem orçamento; pacotes e quantidade definem o total
        if (service.priceUnit === "a_partir_de" || service.priceUnit === "orcamento") {
            throw new HttpError(400, "O valor deste serviço depende do pedido: peça um orçamento ao prestador");
        }
        let unitPrice = service.price;
        let packageName: string | null = null;
        if (service.packages?.length) {
            const index = Number(data.packageIndex);
            const chosen = Number.isInteger(index) ? service.packages[index] : undefined;
            if (!chosen) throw new HttpError(400, "Escolha um dos pacotes do serviço");
            unitPrice = chosen.price;
            packageName = chosen.name;
        }
        let quantity: number | null = null;
        if (service.priceUnit === "hora" || service.priceUnit === "m2") {
            quantity = Number(data.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
                throw new HttpError(400, service.priceUnit === "hora" ? "Informe quantas horas" : "Informe a área em m²");
            }
            quantity = Math.round(quantity * 100) / 100;
        }
        const total = Math.round(unitPrice * (quantity ?? 1) * 100) / 100;

        // Serviços com agenda: o horário precisa estar na agenda, no futuro e livre
        let scheduledAt: Date | null = null;
        let minutes: number | null = null;
        if (service.requiresScheduling) {
            scheduledAt = parseLocalDateTime(data.scheduledAt);
            if (!scheduledAt) throw new HttpError(400, "Escolha um horário na agenda do serviço");
            minutes = durationMinutes(service.duration);
            // agenda, expediente e conflito com qualquer atendimento do prestador que se sobreponha
            await this.assertSlotFree(service, scheduledAt, minutes);
        }

        // Contratação direta usa o preço publicado; valores diferentes só por negociação
        const hire = this.hireRepository.create({
            price: total,
            packageName,
            quantity,
            description_service: (description_service?.trim() || (packageName ? `${service.title} — ${packageName}` : service.title)).slice(0, 100),
            firstContact,
            scheduledAt,
            durationMinutes: minutes,
            provider: { id: service.provider.id },
            user: { id: userId },
            service: { id: service.id },
            paymentRequired: true,
            serviceAddress: service.online ? null : await profileAddress(userId),
        });

        const saved = await this.hireRepository.save(hire);
        // convite de cliente convertido: primeiro pedido feito
        await inviteService.markConverted(userId, "client").catch(() => null);
        const client = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        await notificationService.notify(service.provider?.user?.id, {
            type: "hire.requested",
            title: `Novo pedido: ${service.title}`,
            body: `${client?.name ?? "Um cliente"} contratou seu serviço${scheduledAt ? ` para ${scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}.`,
            link: "/progress",
        });
        return saved;
    }

    async getById(id: number, requesterId: number) {
        const { role } = await this.loadWithRole(id, requesterId);
        return forViewer(await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations }), role);
    }

    /**
     * Cada lado só altera o próprio status:
     * - cliente: CONCLUIDO (depois do prestador) ou CANCELADO (antes de começar);
     * - prestador: ACEITO → EM ANDAMENTO → CONCLUIDO, ou CANCELADO (recusar/cancelar).
     * Cancelar encerra os dois lados e guarda quem cancelou e o motivo.
     */
    async update(id: number, data: Partial<Hire> & { reason?: string }, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        const next = role === "client" ? data.status : data.status_provider;
        const allowed = role === "client"
            ? [StatusEnum.CONCLUIDO, StatusEnum.CANCELADO]
            : [StatusEnum.ACEITO, StatusEnum.EM_ANDAMENTO, StatusEnum.CONCLUIDO, StatusEnum.CANCELADO];

        if (!next || !allowed.includes(next)) throw new HttpError(403, "Alteração não permitida para o seu papel nesta contratação");
        if (hire.status === StatusEnum.CANCELADO || hire.status === StatusEnum.CONCLUIDO) {
            throw new HttpError(400, "Esta contratação já foi encerrada");
        }

        // O cliente só confirma a conclusão depois que o prestador concluir
        if (role === "client" && next === StatusEnum.CONCLUIDO && hire.status_provider !== StatusEnum.CONCLUIDO) {
            throw new HttpError(400, "O prestador do serviço precisa concluir o serviço primeiro. Entre em contato com seu prestador.");
        }

        // Etapas em ordem: solicitado → aceito → em andamento → entregue; sem pular nem voltar
        const current = hire.status_provider;
        if (role === "provider" && next === StatusEnum.ACEITO && current !== StatusEnum.PENDENTE) {
            throw new HttpError(400, "Este pedido já foi respondido");
        }
        if (role === "provider" && next === StatusEnum.EM_ANDAMENTO && current !== StatusEnum.ACEITO) {
            throw new HttpError(400, current === StatusEnum.PENDENTE ? "Aceite o pedido antes de iniciar o serviço" : "O serviço só pode ser iniciado depois de aceito");
        }
        // RN: pagamento (simulado) antes de o serviço começar
        if (role === "provider" && next === StatusEnum.EM_ANDAMENTO && this.awaitingPayment(hire)) {
            throw new HttpError(400, "Aguardando o pagamento do cliente");
        }
        if (role === "provider" && next === StatusEnum.EM_ANDAMENTO && this.awaitingAddress(hire)) {
            throw new HttpError(400, "Aguardando o cliente informar o endereço do atendimento");
        }
        // serviço com agenda (RN05): o pedido negociado precisa de horário marcado antes de começar
        if (role === "provider" && next === StatusEnum.EM_ANDAMENTO && this.awaitingSchedule(hire)) {
            throw new HttpError(400, "Aguardando o cliente escolher o horário na agenda");
        }
        // o cliente cancela só antes de o serviço começar
        if (role === "client" && next === StatusEnum.CANCELADO && current === StatusEnum.EM_ANDAMENTO) {
            throw new HttpError(400, "O serviço já começou. Fale com o prestador pela conversa.");
        }
        if (role === "provider" && next === StatusEnum.CONCLUIDO && current !== StatusEnum.EM_ANDAMENTO) {
            throw new HttpError(400, "Inicie o serviço antes de marcá-lo como concluído");
        }
        // Depois de entregue, nenhum dos lados cancela: o cliente confirma (ou fala com o prestador)
        if (next === StatusEnum.CANCELADO && current === StatusEnum.CONCLUIDO) {
            throw new HttpError(400, "O serviço já foi entregue e não pode mais ser cancelado");
        }

        if (next === StatusEnum.CANCELADO) {
            hire.status = StatusEnum.CANCELADO;
            hire.status_provider = StatusEnum.CANCELADO;
            hire.cancelledBy = role === "client" ? "cliente" : "prestador";
            hire.cancelReason = String(data.reason ?? "").trim().slice(0, 300) || null;
            hire.lateCancel = this.isLateCancel(hire);
            hire.rescheduleTo = null;
            hire.rescheduleBy = null;
        } else if (role === "provider" && next === StatusEnum.ACEITO) {
            hire.status_provider = StatusEnum.ACEITO;
            hire.acceptedAt = new Date();
        } else if (role === "client") {
            hire.status = next;
            if (next === StatusEnum.CONCLUIDO) hire.confirmedAt = new Date();
        } else {
            hire.status_provider = next;
            if (next === StatusEnum.EM_ANDAMENTO) hire.startedAt = new Date();
            if (next === StatusEnum.CONCLUIDO) hire.finishedAt = new Date();
        }
        await this.hireRepository.save(hire);
        // dinheiro acompanha o pedido: cancelado → estorno; conclusão confirmada → liberado ao prestador
        if (next === StatusEnum.CANCELADO) await paymentService.refund(hire.id);
        if (role === "client" && next === StatusEnum.CONCLUIDO) await paymentService.release(hire.id);
        await this.notifyUpdate(hire, role, next);
        return forViewer(await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations }), role);
    }

    /**
     * Cancelar um pedido já aceito dentro do prazo de cancelamento do serviço
     * (ex.: "até 24h antes") fica registrado. Recusar um pedido não conta.
     */
    private isLateCancel(hire: Hire) {
        if (!hire.scheduledAt || !hire.acceptedAt) return false;
        const hours = noticeHours(hire.service?.cancellationNotice);
        return hours > 0 && Date.now() > hire.scheduledAt.getTime() - hours * 3600000;
    }

    /** Hora local por extenso para as notificações */
    private when(date: Date) {
        return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    }

    /** Confere se o atendimento pode acontecer em `start` (agenda, expediente e conflitos), ignorando a própria contratação. */
    private async assertSlotFree(service: Service & { provider: ServiceProvider }, start: Date, minutes: number, ignoreHireId?: number) {
        if (start.getTime() <= Date.now()) throw new HttpError(400, "Escolha um horário futuro");
        if (!fitsSchedule(service.scheduleSlots, start)) throw new HttpError(400, "Este horário não está disponível na agenda do prestador");
        if (!withinBusinessHours(this.hoursOf(service.provider.availabilities), start, minutes))
            throw new HttpError(400, "O atendimento não cabe no expediente do prestador nesse horário");
        const busy = await this.busyOf(service.provider.id, new Date(start.getTime() - 30 * 86400000), new Date(start.getTime() + minutes * 60000), ignoreHireId);
        if (busy.some((b) => overlaps(start, minutes, b.start, b.minutes)))
            throw new HttpError(409, "Esse horário conflita com outro atendimento do prestador. Escolha outro.");
    }

    /** Atendimento presencial sem endereço informado */
    private awaitingAddress(hire: Hire) {
        return hire.paymentRequired && !!hire.service && !hire.service.online && !hire.serviceAddress;
    }

    /** O cliente informa ou troca o endereço do atendimento antes de o serviço começar. */
    async setAddress(id: number, data: unknown, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        if (role !== "client") throw new HttpError(403, "Quem informa o endereço é o cliente");
        if (hire.service?.online) throw new HttpError(400, "Este serviço é online e não precisa de endereço");
        if (hire.status !== StatusEnum.PENDENTE || ![StatusEnum.PENDENTE, StatusEnum.ACEITO].includes(hire.status_provider)) {
            throw new HttpError(400, "Só dá para mudar o endereço antes de o serviço começar");
        }
        hire.serviceAddress = parseAddress(data);
        await this.hireRepository.save(hire);
        if (hire.acceptedAt) {
            await notificationService.notify(hire.provider?.user?.id, {
                type: "hire.address",
                title: `Endereço do atendimento: ${hire.service?.title ?? hire.description_service}`,
                body: `${hire.user?.name ?? "O cliente"} informou o endereço: ${hire.serviceAddress.street}, ${hire.serviceAddress.num} — ${hire.serviceAddress.neighborhood}, ${hire.serviceAddress.city}.`,
                link: "/progress",
            });
        }
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
    }

    /** Pedido aceito que ainda não foi pago */
    private awaitingPayment(hire: Hire) {
        return hire.paymentRequired && !hire.payment;
    }

    /**
     * Pagamento simulado pelo cliente, depois do aceite do prestador.
     * O valor fica retido e só é liberado ao prestador quando o cliente confirma a conclusão.
     */
    async pay(id: number, method: unknown, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        if (role !== "client") throw new HttpError(403, "Quem paga é o cliente");
        if (!hire.paymentRequired) throw new HttpError(400, "Este pedido não usa pagamento pela plataforma");
        if (hire.payment) throw new HttpError(400, "Este pedido já foi pago");
        if (hire.status !== StatusEnum.PENDENTE || hire.status_provider !== StatusEnum.ACEITO) {
            throw new HttpError(400, hire.status_provider === StatusEnum.PENDENTE ? "Aguarde o prestador aceitar o pedido para pagar" : "Este pedido não pode mais ser pago");
        }
        if (typeof method !== "string" || !METHODS.includes(method)) throw new HttpError(400, "Escolha a forma de pagamento: Pix, cartão ou boleto");
        const payment = await paymentService.pay({ hireId: hire.id, providerId: hire.provider.id, userId: requesterId, amount: Number(hire.price), method: method as PaymentMethod });
        const title = hire.service?.title ?? hire.description_service;
        await notificationService.notify(hire.provider?.user?.id, {
            type: "hire.paid",
            title: `Pagamento confirmado: ${title}`,
            body: `${hire.user?.name ?? "O cliente"} pagou ${payment.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Você recebe ${payment.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} quando o cliente confirmar a conclusão.`,
            link: "/progress",
        });
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
    }

    /** Pedido negociado de serviço com agenda que ainda não tem horário marcado. */
    private awaitingSchedule(hire: Hire) {
        return !!hire.service?.requiresScheduling && !hire.scheduledAt;
    }

    /**
     * Pedido que nasceu de uma negociação (sem horário): o cliente escolhe o horário na agenda do serviço.
     * Mesmas regras de um pedido direto: agenda, expediente e conflitos.
     */
    async schedule(id: number, scheduledAt: unknown, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        if (role !== "client") throw new HttpError(403, "Quem escolhe o horário é o cliente");
        if (!this.awaitingSchedule(hire)) throw new HttpError(400, "Este pedido não está aguardando horário");
        if (hire.status !== StatusEnum.PENDENTE || hire.status_provider !== StatusEnum.ACEITO) {
            throw new HttpError(400, "Este pedido não pode mais ser agendado");
        }
        const start = parseLocalDateTime(scheduledAt);
        if (!start) throw new HttpError(400, "Escolha um horário na agenda do serviço");
        const service = await this.serviceRepository.findOne({ where: { id: hire.service.id }, relations: { provider: { availabilities: true } } });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        const minutes = hire.durationMinutes ?? durationMinutes(service.duration);
        await this.assertSlotFree(service, start, minutes, hire.id);

        hire.scheduledAt = start;
        hire.durationMinutes = minutes;
        await this.hireRepository.save(hire);
        await notificationService.notify(hire.provider?.user?.id, {
            type: "hire.scheduled",
            title: `Horário marcado: ${hire.service?.title ?? hire.description_service}`,
            body: `${hire.user?.name ?? "O cliente"} marcou o atendimento para ${this.when(start)}.`,
            link: "/progress",
        });
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
    }

    /** Uma das partes pede um novo horário; a outra aceita ou recusa. */
    async requestReschedule(id: number, scheduledAt: unknown, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        if (!hire.scheduledAt) throw new HttpError(400, "Este pedido não tem horário agendado");
        if (hire.status !== StatusEnum.PENDENTE || ![StatusEnum.PENDENTE, StatusEnum.ACEITO].includes(hire.status_provider)) {
            throw new HttpError(400, "Só dá para mudar o horário antes de o serviço começar");
        }
        const start = parseLocalDateTime(scheduledAt);
        if (!start) throw new HttpError(400, "Escolha um horário na agenda do serviço");
        if (start.getTime() === hire.scheduledAt.getTime()) throw new HttpError(400, "Esse já é o horário marcado");
        const service = await this.serviceRepository.findOne({ where: { id: hire.service.id }, relations: { provider: { availabilities: true } } });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        await this.assertSlotFree(service, start, hire.durationMinutes ?? durationMinutes(service.duration), hire.id);

        hire.rescheduleTo = start;
        hire.rescheduleBy = role === "client" ? "cliente" : "prestador";
        await this.hireRepository.save(hire);
        const who = role === "client" ? hire.user?.name ?? "O cliente" : hire.provider?.companyName || hire.provider?.professionalName || "O prestador";
        await notificationService.notify(role === "client" ? hire.provider?.user?.id : hire.user?.id, {
            type: "hire.reschedule",
            title: `Novo horário proposto: ${hire.service?.title ?? hire.description_service}`,
            body: `${who} pediu para mudar de ${this.when(hire.scheduledAt)} para ${this.when(start)}.`,
            link: role === "client" ? "/progress" : "/hires",
        });
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
    }

    /**
     * Resposta ao pedido de novo horário: a outra parte aceita ou recusa;
     * quem pediu pode desistir (accept = false).
     */
    async answerReschedule(id: number, accept: boolean, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        if (!hire.rescheduleTo || !hire.rescheduleBy) throw new HttpError(400, "Não há pedido de novo horário");
        const mine = role === "client" ? "cliente" : "prestador";
        if (accept && hire.rescheduleBy === mine) throw new HttpError(403, "Quem responde é a outra parte");
        const proposed = hire.rescheduleTo;
        const requester = hire.rescheduleBy;

        if (accept) {
            const service = await this.serviceRepository.findOne({ where: { id: hire.service.id }, relations: { provider: { availabilities: true } } });
            if (!service) throw new HttpError(404, "Serviço não encontrado");
            await this.assertSlotFree(service, proposed, hire.durationMinutes ?? durationMinutes(service.duration), hire.id);
            hire.scheduledAt = proposed;
        }
        hire.rescheduleTo = null;
        hire.rescheduleBy = null;
        await this.hireRepository.save(hire);

        // avisa quem pediu (ou, se ele desistiu, a outra parte)
        const clientId = hire.user?.id;
        const providerUserId = hire.provider?.user?.id;
        const target = requester === mine ? (mine === "cliente" ? providerUserId : clientId) : (requester === "cliente" ? clientId : providerUserId);
        const title = hire.service?.title ?? hire.description_service;
        await notificationService.notify(target, {
            type: accept ? "hire.rescheduled" : "hire.reschedule.declined",
            title: accept ? `Horário alterado: ${title}` : requester === mine ? `Pedido de novo horário retirado: ${title}` : `Novo horário recusado: ${title}`,
            body: accept ? `O atendimento passou para ${this.when(proposed)}.` : `O horário continua ${this.when(hire.scheduledAt!)}.`,
            link: target === clientId ? "/hires" : "/progress",
        });
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
    }

    /** Avisa a outra parte sobre a mudança de etapa. */
    private async notifyUpdate(hire: Hire, role: Role, next: StatusEnum) {
        const title = hire.service?.title ?? hire.description_service;
        const clientId = hire.user?.id;
        const providerUserId = hire.provider?.user?.id;
        const providerName = hire.provider?.companyName || hire.provider?.professionalName || "O prestador";
        if (next === StatusEnum.CANCELADO) {
            const target = role === "client" ? providerUserId : clientId;
            const refused = role === "provider" && !hire.acceptedAt;
            await notificationService.notify(target, {
                type: refused ? "hire.refused" : "hire.cancelled",
                title: `${refused ? "Pedido recusado" : "Pedido cancelado"}: ${title}`,
                body: `${role === "client" ? hire.user?.name ?? "O cliente" : providerName} ${refused ? "recusou" : "cancelou"} o pedido.${hire.cancelReason ? ` Motivo: ${hire.cancelReason}` : ""}`,
                link: role === "client" ? "/progress" : "/hires",
            });
        } else if (role === "provider" && next === StatusEnum.ACEITO) {
            await notificationService.notify(clientId, { type: "hire.accepted", title: `Pedido aceito: ${title}`, body: `${providerName} aceitou seu pedido.`, link: "/hires" });
        } else if (role === "provider" && next === StatusEnum.EM_ANDAMENTO) {
            await notificationService.notify(clientId, { type: "hire.started", title: `Serviço iniciado: ${title}`, body: `${providerName} começou o serviço.`, link: "/hires" });
        } else if (role === "provider" && next === StatusEnum.CONCLUIDO) {
            await notificationService.notify(clientId, { type: "hire.delivered", title: `Confirme a conclusão: ${title}`, body: `${providerName} marcou o serviço como entregue.`, link: "/hires" });
        } else if (role === "client" && next === StatusEnum.CONCLUIDO) {
            await notificationService.notify(providerUserId, { type: "hire.done", title: `Serviço concluído: ${title}`, body: `${hire.user?.name ?? "O cliente"} confirmou a conclusão. Avalie o cliente.`, link: "/progress" });
        }
    }

    /**
     * Pedidos sem resposta expiram: depois de HIRE_EXPIRY_HOURS (padrão 48 h) ou
     * quando o horário agendado chega sem aceite. O horário volta a ficar livre.
     */
    async expireStale() {
        const hours = Number(process.env.HIRE_EXPIRY_HOURS) || 48;
        const limit = new Date(Date.now() - hours * 3_600_000);
        const now = new Date();
        const stale = await this.hireRepository.find({
            where: [
                { status: StatusEnum.PENDENTE, status_provider: StatusEnum.PENDENTE, createdAt: LessThan(limit) },
                { status: StatusEnum.PENDENTE, status_provider: StatusEnum.PENDENTE, scheduledAt: LessThan(now) },
            ],
            relations: { user: true, provider: { user: true }, service: true },
        });
        for (const hire of stale) {
            hire.status = StatusEnum.CANCELADO;
            hire.status_provider = StatusEnum.CANCELADO;
            hire.cancelledBy = "sistema";
            hire.cancelReason = "Expirado: o prestador não respondeu a tempo";
            await this.hireRepository.save(hire);
            const title = hire.service?.title ?? hire.description_service;
            await notificationService.notify(hire.user?.id, { type: "hire.expired", title: `Pedido expirou: ${title}`, body: "O prestador não respondeu a tempo. Você pode contratar outro profissional.", link: "/hires" });
            await notificationService.notify(hire.provider?.user?.id, { type: "hire.expired", title: `Pedido expirado: ${title}`, body: "O pedido foi cancelado por falta de resposta.", link: "/progress" });
        }
        return stale.length;
    }

    async remove(id: number, requesterId: number) {
        const { hire } = await this.loadWithRole(id, requesterId);
        await this.hireRepository.remove(hire);
        return { message: "Serviço removido com sucesso" }
    }

    /** Pedidos recebidos por um prestador — só o dono do perfil pode ver. */
    async getListByProviderId(id: number, requesterId: number) {
        const provider = await this.providerRepository.findOne({ where: { id }, relations: { user: true } });
        if (!provider) throw new HttpError(404, "Prestador não encontrado");
        if (provider.user?.id !== requesterId) throw new HttpError(403, "Acesso restrito ao prestador");
        await this.expireStale(); // a lista já chega sem pedidos vencidos

        const hires = await this.hireRepository.find({ relations: this.fullRelations, where: {
            provider: {id: id}
        }, order: { id: "DESC" }});
        // o prestador vê quantas vezes o cliente cancelou em cima da hora
        const late = await statsService.clientLateCancellations([...new Set(hires.map((h) => h.user?.id).filter(Boolean) as number[])]);
        return hires.map((h) => ({ ...forViewer(h, "provider")!, clientLateCancellations: late.get(h.user?.id) ?? 0 }));
    }

    /** Expediente do prestador por dia da semana */
    private hoursOf(availabilities: Availability[] | undefined): BusinessHours {
        return Object.fromEntries((availabilities ?? []).map((a) => [a.day, { start: a.start, end: a.end }]));
    }

    /** Atendimentos agendados (não cancelados) do prestador que começam no período */
    private async busyOf(providerId: number, from: Date, to: Date, ignoreHireId?: number) {
        const hires = await this.hireRepository.find({
            where: { provider: { id: providerId }, scheduledAt: Between(from, to), status: Not(StatusEnum.CANCELADO), status_provider: Not(StatusEnum.CANCELADO), ...(ignoreHireId ? { id: Not(ignoreHireId) } : {}) },
            select: { id: true, scheduledAt: true, durationMinutes: true },
        });
        return hires.map((h) => ({ start: h.scheduledAt!, minutes: h.durationMinutes ?? 60 }));
    }

    /**
     * Agenda do serviço para o cliente escolher: períodos ocupados do prestador (sem dados das pessoas),
     * expediente e duração do serviço.
     */
    async bookedSlots(serviceId: number, ignoreHireId?: number) {
        const service = await this.serviceRepository.findOne({ where: { id: serviceId }, relations: { provider: { availabilities: true } } });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        const now = Date.now();
        const busy = await this.busyOf(service.provider.id, new Date(now - 30 * 86400000), new Date(now + 90 * 86400000), ignoreHireId);
        return {
            busy: busy
                .filter((b) => b.start.getTime() + b.minutes * 60000 > now)
                .map((b) => ({ start: b.start, end: new Date(b.start.getTime() + b.minutes * 60000) })),
            hours: this.hoursOf(service.provider.availabilities),
            // fechado até: a agenda só oferece horários a partir da reabertura
            closedUntil: openState(service.provider).closedUntil,
            closed: !openState(service.provider).open,
            durationMinutes: durationMinutes(service.duration),
        };
    }

    async getListByUserId(userId: number) {
        await this.expireStale();
        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            user: { id: userId }
        }, order: { id: "DESC" }});
    }
}
