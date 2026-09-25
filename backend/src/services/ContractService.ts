import { AppDataSource } from "../config/data-source";
import { Contract, ContractSignature } from "../models/Contract";
import { Conversation } from "../models/Conversation";
import { HttpError } from "./HireService";

export class ContractService {
    private contractRepository = AppDataSource.getRepository(Contract);

    private async load(id: number, requesterId: number) {
        const contract = await this.contractRepository.findOne({
            where: { id },
            relations: { provider: { user: true }, hire: { service: true }, user: { address: true } },
        });

        // Contrato tem dados pessoais: só o cliente e o prestador podem ver (os outros recebem 404)
        if (!contract || (contract.user?.id !== requesterId && contract.provider?.user?.id !== requesterId)) {
            throw new HttpError(404, "Contrato não encontrado");
        }
        return contract;
    }

    async getById(id: number, requesterId: number) {
        const contract = await this.load(id, requesterId);

        // Termos combinados na negociação que gerou o contrato (pagamento, início, duração)
        const conversation = await AppDataSource.getRepository(Conversation).findOne({ where: { contract: { id } } });

        const { provider, user, clientSignature, providerSignature, ...rest } = contract;
        // IP fica só no banco (auditoria); a tela mostra o restante
        const publicSig = (s: ContractSignature | null) => (s ? { ...s, ip: undefined } : null);
        return {
            ...rest,
            myRole: user?.id === requesterId ? "cliente" : "prestador",
            clientSignature: publicSig(clientSignature),
            providerSignature: publicSig(providerSignature),
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

    /**
     * Assinatura eletrônica simples: nome digitado + aceite + hash SHA-256 do texto do contrato
     * calculado no navegador. Data, navegador e IP são registrados pelo servidor.
     */
    async sign(
        id: number,
        requesterId: number,
        data: { name?: string; hash?: string; accepted?: boolean; geolocation?: { latitude: number; longitude: number } | null },
        meta: { userAgent: string; ip: string | null }
    ) {
        const contract = await this.load(id, requesterId);
        const isClient = contract.user?.id === requesterId;
        const current = isClient ? contract.clientSignature : contract.providerSignature;
        if (current) throw new HttpError(400, "Você já assinou este contrato");

        const name = String(data.name ?? "").trim();
        if (!data.accepted) throw new HttpError(400, "Confirme que leu e concorda com os termos do contrato");
        if (name.length < 3) throw new HttpError(400, "Digite seu nome completo como assinatura");
        const hash = String(data.hash ?? "");
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new HttpError(400, "Não foi possível calcular a impressão digital do contrato");

        // As duas partes precisam assinar exatamente o mesmo texto
        const other = isClient ? contract.providerSignature : contract.clientSignature;
        if (other && other.hash !== hash) {
            throw new HttpError(409, "O texto do contrato mudou desde a outra assinatura. Recarregue a página.");
        }

        const geo = data.geolocation;
        const signature: ContractSignature = {
            name: name.slice(0, 120),
            signedAt: new Date().toISOString(),
            userAgent: meta.userAgent,
            ip: meta.ip,
            geolocation: geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude) ? { latitude: geo.latitude, longitude: geo.longitude } : null,
            hash,
        };
        if (isClient) contract.clientSignature = signature;
        else contract.providerSignature = signature;
        await this.contractRepository.save(contract);
        return this.getById(id, requesterId);
    }
}
