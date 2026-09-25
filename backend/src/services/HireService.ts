import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { durationMinutes, fitsSchedule, overlaps, parseLocalDateTime, withinBusinessHours, type BusinessHours } from "../utils/schedule";
import { Between, LessThan, Not } from "typeorm";
import { Availability } from "../models/Availability";
import { notificationService } from "./NotificationService";
import { User } from "../models/User";

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
    private readonly fullRelations = { user: true, provider: true, service: { category: true, provider: true } };

    /** Carrega a contratação com os donos de cada lado e diz qual papel o usuário tem nela. */
    private async loadWithRole(id: number, requesterId: number): Promise<{ hire: Hire; role: Role }> {
        const hire = await this.hireRepository.findOne({
            where: { id },
            relations: { user: true, provider: { user: true }, service: true },
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
            if (scheduledAt.getTime() <= Date.now()) throw new HttpError(400, "Escolha um horário futuro");
            if (!fitsSchedule(service.scheduleSlots, scheduledAt)) throw new HttpError(400, "Este horário não está disponível na agenda do prestador");
            minutes = durationMinutes(service.duration);
            if (!withinBusinessHours(this.hoursOf(service.provider.availabilities), scheduledAt, minutes))
                throw new HttpError(400, "O atendimento não cabe no expediente do prestador nesse horário");
            // conflito com qualquer atendimento do prestador que se sobreponha (não só o mesmo início)
            const busy = await this.busyOf(service.provider.id, new Date(scheduledAt.getTime() - 30 * 86400000), new Date(scheduledAt.getTime() + minutes * 60000));
            if (busy.some((b) => overlaps(scheduledAt!, minutes!, b.start, b.minutes)))
                throw new HttpError(409, "Esse horário conflita com outro atendimento do prestador. Escolha outro.");
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
            service: { id: service.id }
        });

        const saved = await this.hireRepository.save(hire);
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
        await this.loadWithRole(id, requesterId);
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
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
        } else if (role === "provider" && next === StatusEnum.ACEITO) {
            hire.status_provider = StatusEnum.ACEITO;
            hire.acceptedAt = new Date();
        } else if (role === "client") {
            hire.status = next;
        } else {
            hire.status_provider = next;
        }
        await this.hireRepository.save(hire);
        await this.notifyUpdate(hire, role, next);
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

        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            provider: {id: id}
        }, order: { id: "DESC" }});
    }

    /** Expediente do prestador por dia da semana */
    private hoursOf(availabilities: Availability[] | undefined): BusinessHours {
        return Object.fromEntries((availabilities ?? []).map((a) => [a.day, { start: a.start, end: a.end }]));
    }

    /** Atendimentos agendados (não cancelados) do prestador que começam no período */
    private async busyOf(providerId: number, from: Date, to: Date) {
        const hires = await this.hireRepository.find({
            where: { provider: { id: providerId }, scheduledAt: Between(from, to), status: Not(StatusEnum.CANCELADO), status_provider: Not(StatusEnum.CANCELADO) },
            select: { id: true, scheduledAt: true, durationMinutes: true },
        });
        return hires.map((h) => ({ start: h.scheduledAt!, minutes: h.durationMinutes ?? 60 }));
    }

    /**
     * Agenda do serviço para o cliente escolher: períodos ocupados do prestador (sem dados das pessoas),
     * expediente e duração do serviço.
     */
    async bookedSlots(serviceId: number) {
        const service = await this.serviceRepository.findOne({ where: { id: serviceId }, relations: { provider: { availabilities: true } } });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        const now = Date.now();
        const busy = await this.busyOf(service.provider.id, new Date(now - 30 * 86400000), new Date(now + 90 * 86400000));
        return {
            busy: busy
                .filter((b) => b.start.getTime() + b.minutes * 60000 > now)
                .map((b) => ({ start: b.start, end: new Date(b.start.getTime() + b.minutes * 60000) })),
            hours: this.hoursOf(service.provider.availabilities),
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
