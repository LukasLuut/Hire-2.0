import { AppDataSource } from "../config/data-source";
import { Contract } from "../models/Contract";
import { Conversation } from "../models/Conversation";

interface ContractInterface {
    code: string;
    price: number;
    description_service: string;
    providerId: number;
    hireId: number;
    userId: number;
    firstContact: Date;
    lastContact: Date;
}

export class ContractService {
    private contractRepository = AppDataSource.getRepository(Contract);

    async create(data: ContractInterface) {
        const exists = await this.contractRepository.findOne({
            where: { code: data.code },
        });

        if (exists) throw new Error("Contrato já existente");

        const bodyCopy = {
            code: data.code,
            price: data.price,
            description_service: data.description_service,
            provider: { id: data.providerId},
            hire: { id: data.hireId},
            user: { id: data.userId},
            firstContact: data.firstContact,
            lastContact: data.lastContact
        }

        const contract = this.contractRepository.create(bodyCopy);
        return await this.contractRepository.save(contract);
    }

    async list() {
        return await this.contractRepository.find();
    }

    async update(id: number, data: Partial<Contract>) {
        const contract = await this.contractRepository.findOne({ where: { id } });

        if (!contract) throw new Error("Contrato não encontrado");
        const { ...rest } = data;
        Object.assign(contract, rest);
        return await this.contractRepository.save(contract);
    }

    async remove(id: number) {
        const contract = await this.contractRepository.findOne({ where: { id } });

        if (!contract) throw new Error("Contrato não encontrado");

        await this.contractRepository.remove(contract);

        return { message: "Categoria removida com sucesso" };
    }

    async getById(id: number, requesterId?: number) {
        const contract = await this.contractRepository.findOne({
            where: { id },
            relations: { provider: { user: true }, hire: { service: true }, user: { address: true } },
        });

        if (!contract) throw new Error("Contrato não encontrado");

        // Contrato tem dados pessoais: só o cliente e o prestador podem ver
        if (requesterId !== undefined && contract.user?.id !== requesterId && contract.provider?.user?.id !== requesterId) {
            throw new Error("Contrato não encontrado");
        }

        // Termos combinados na negociação que gerou o contrato (pagamento, início, duração)
        const conversation = await AppDataSource.getRepository(Conversation).findOne({ where: { contract: { id } } });

        const { provider, user, ...rest } = contract;
        return {
            ...rest,
            user: user ? { id: user.id, name: user.name, email: user.email, cpf_cnpj: user.cpf_cnpj, address: user.address ?? null } : null,
            provider: provider
                ? {
                    id: provider.id,
                    companyName: provider.companyName,
                    professionalName: provider.professionalName,
                    professionalEmail: provider.professionalEmail,
                    professionalPhone: provider.professionalPhone,
                    cnpj: provider.cnpj,
                    userId: provider.user?.id,
                }
                : null,
            terms: conversation?.topics ?? [],
        };
    }
}
