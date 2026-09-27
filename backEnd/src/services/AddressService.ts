import { AppDataSource } from "../config/data-source";
import { Address } from "../models/Address";
import { Category } from "../models/Category";
import { User } from "../models/User";

export class AddressService {
    private addressRepository = AppDataSource.getRepository(Address);
    private userRepository = AppDataSource.getRepository(User)

    async create(userId: number, data: { num: number, street: string, neighborhood: string, city: string, state: string, country: string, postalCode: string }) {

        const user = await this.userRepository.findOne({ where: { id: userId }, relations: { address: true } });
        if (!user) throw new Error("Usuário não existente");

        // só os campos do endereço (um "id" vindo do cliente não pode apontar para o endereço de outra pessoa);
        // quem já tem endereço atualiza o próprio registro
        const fields = {
            num: Number(data.num) || 0,
            street: String(data.street ?? "").trim(),
            neighborhood: String(data.neighborhood ?? "").trim(),
            city: String(data.city ?? "").trim(),
            state: String(data.state ?? "").trim(),
            country: String(data.country ?? "Brasil").trim(),
            postalCode: String(data.postalCode ?? "").trim().slice(0, 9),
        };
        const address = user.address ? Object.assign(user.address, fields) : this.addressRepository.create(fields);
        await this.addressRepository.save(address)

        user.address = address;
        await this.userRepository.save(user);

        return address;
    }
}