import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { fitsSchedule, parseLocalDateTime } from "../utils/schedule";
import { MoreThan, Not } from "typeorm";

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
            relations: { user: true, provider: { user: true } },
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

        return await this.hireRepository.save(hire);
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

        if (next === StatusEnum.CANCELADO) {
            hire.status = StatusEnum.CANCELADO;
            hire.status_provider = StatusEnum.CANCELADO;
        } else if (role === "client") {
            hire.status = next;
        } else {
            hire.status_provider = next;
        }
        await this.hireRepository.save(hire);
        return await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
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
