import { AppDataSource } from "../config/data-source";
import { Hire, StatusEnum } from "../models/Hire";

export class HireService {
    private hireRepository = AppDataSource.getRepository(Hire);

    // Relações necessárias para exibir uma contratação completa no frontend
    private readonly fullRelations = { user: true, provider: true, service: { category: true, provider: true } };

    async create(data: { price: number, description_service: string, firstContact: Date, providerId: string, userId: string, serviceId: string }) {
        const { price, description_service, firstContact, providerId, userId, serviceId } = data;

         const hire = this.hireRepository.create({
            price,
            description_service,
            firstContact,
            provider: { id: Number(providerId) },
            user: { id: Number(userId) },
            service: { id: Number(serviceId) }
         });

        return await this.hireRepository.save(hire);
    }

    async list() {
        return await this.hireRepository.find({ relations: this.fullRelations, order: { id: "DESC" } });
    }

    async getById(id: number) {
        const hire = await this.hireRepository.findOne({ where: { id }, relations: this.fullRelations });
        if (!hire) throw new Error("Contratação não encontrada");
        return hire;
    }

    async update(id: number, data: Partial<Hire>) {
        const hire = await this.hireRepository.findOne({ where: { id } });
        if (!hire) throw new Error("Serviço não encontrado");

        // O cliente só confirma a conclusão depois que o prestador concluir
        if (data.status === StatusEnum.CONCLUIDO && hire.status_provider !== StatusEnum.CONCLUIDO) {
            throw new Error("O prestador do serviço precisa concluir o serviço primeiro. Entre em contato com seu prestador.");
        }

        const { ...rest } = data
        Object.assign(hire, rest);
        return await this.hireRepository.save(hire);
    }

    async remove(id: number) {
        const hire = await this.hireRepository.findOne({ where: { id } });

        if (!hire) throw new Error("Serviço não encontrado")

        await this.hireRepository.remove(hire);

        return { message: "Serviço removido com sucesso" }
    }

    async getListByProviderId(id: number) {
        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            provider: {id: id}
        }, order: { id: "DESC" }});
    }

    async getListByUserId(userId: number) {
        return await this.hireRepository.find({ relations: this.fullRelations, where: {
            user: { id: userId }
        }, order: { id: "DESC" }});
    }
}
