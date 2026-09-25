import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { fitsSchedule, parseLocalDateTime } from "../utils/schedule";
import { MoreThan, Not } from "typeorm";
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

    async create(data: { price: number, description_service: string, firstContact: Date, serviceId: string, scheduledAt?: string }, userId: number) {
        const { description_service, firstContact, serviceId } = data;

        const service = await this.serviceRepository.findOne({
            where: { id: Number(serviceId) },
            relations: { provider: { user: true } },
        });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        if (service.provider?.user?.id === userId) throw new HttpError(400, "Você não pode contratar o próprio serviço");
        if (service.active === false) throw new HttpError(400, "Este serviço está pausado pelo prestador e não recebe pedidos no momento");

        // Serviços com agenda: o horário precisa estar na agenda, no futuro e livre
        let scheduledAt: Date | null = null;
        if (service.requiresScheduling) {
            scheduledAt = parseLocalDateTime(data.scheduledAt);
            if (!scheduledAt) throw new HttpError(400, "Escolha um horário na agenda do serviço");
            if (scheduledAt.getTime() <= Date.now()) throw new HttpError(400, "Escolha um horário futuro");
            if (!fitsSchedule(service.scheduleSlots, scheduledAt)) throw new HttpError(400, "Este horário não está disponível na agenda do prestador");
            const taken = await this.hireRepository.findOne({
                where: { provider: { id: service.provider.id }, scheduledAt, status: Not(StatusEnum.CANCELADO) },
            });
            if (taken) throw new HttpError(409, "Este horário acabou de ser reservado. Escolha outro.");
        }

        // Contratação direta usa o preço publicado; valores diferentes só por negociação
        const hire = this.hireRepository.create({
            price: service.price,
            description_service: (description_service?.trim() || service.title).slice(0, 100),
            firstContact,
            scheduledAt,
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
     * - cliente: CONCLUIDO (depois do prestador) ou CANCELADO;
     * - prestador: EM ANDAMENTO, CONCLUIDO ou CANCELADO.
     * Cancelar encerra os dois lados.
     */
    async update(id: number, data: Partial<Hire>, requesterId: number) {
        const { hire, role } = await this.loadWithRole(id, requesterId);
        const next = role === "client" ? data.status : data.status_provider;
        const allowed = role === "client"
            ? [StatusEnum.CONCLUIDO, StatusEnum.CANCELADO]
            : [StatusEnum.EM_ANDAMENTO, StatusEnum.CONCLUIDO, StatusEnum.CANCELADO];

        if (!next || !allowed.includes(next)) throw new HttpError(403, "Alteração não permitida para o seu papel nesta contratação");
        if (hire.status === StatusEnum.CANCELADO || hire.status === StatusEnum.CONCLUIDO) {
            throw new HttpError(400, "Esta contratação já foi encerrada");
        }

        // O cliente só confirma a conclusão depois que o prestador concluir
        if (role === "client" && next === StatusEnum.CONCLUIDO && hire.status_provider !== StatusEnum.CONCLUIDO) {
            throw new HttpError(400, "O prestador do serviço precisa concluir o serviço primeiro. Entre em contato com seu prestador.");
        }

        // Etapas em ordem: solicitado → em andamento → entregue; sem pular nem voltar
        const current = hire.status_provider;
        if (role === "provider" && next === StatusEnum.EM_ANDAMENTO && current !== StatusEnum.PENDENTE) {
            throw new HttpError(400, "O serviço só pode ser iniciado enquanto estiver aguardando início");
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
            await notificationService.notify(target, {
                type: "hire.cancelled",
                title: `Pedido cancelado: ${title}`,
                body: role === "client" ? `${hire.user?.name ?? "O cliente"} cancelou o pedido.` : `${providerName} recusou ou cancelou o pedido.`,
                link: role === "client" ? "/progress" : "/hires",
            });
        } else if (role === "provider" && next === StatusEnum.EM_ANDAMENTO) {
            await notificationService.notify(clientId, { type: "hire.started", title: `Serviço iniciado: ${title}`, body: `${providerName} começou o serviço.`, link: "/hires" });
        } else if (role === "provider" && next === StatusEnum.CONCLUIDO) {
            await notificationService.notify(clientId, { type: "hire.delivered", title: `Confirme a conclusão: ${title}`, body: `${providerName} marcou o serviço como entregue.`, link: "/hires" });
        } else if (role === "client" && next === StatusEnum.CONCLUIDO) {
            await notificationService.notify(providerUserId, { type: "hire.done", title: `Serviço concluído: ${title}`, body: `${hire.user?.name ?? "O cliente"} confirmou a conclusão. Avalie o cliente.`, link: "/progress" });
        }
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

        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            provider: {id: id}
        }, order: { id: "DESC" }});
    }

    /** Horários futuros já reservados com o prestador do serviço (sem dados das pessoas). */
    async bookedSlots(serviceId: number) {
        const service = await this.serviceRepository.findOne({ where: { id: serviceId }, relations: { provider: true } });
        if (!service) throw new HttpError(404, "Serviço não encontrado");
        const hires = await this.hireRepository.find({
            where: { provider: { id: service.provider.id }, scheduledAt: MoreThan(new Date()), status: Not(StatusEnum.CANCELADO) },
            select: { id: true, scheduledAt: true },
        });
        return hires.map((h) => h.scheduledAt);
    }

    async getListByUserId(userId: number) {
        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            user: { id: userId }
        }, order: { id: "DESC" }});
    }
}
