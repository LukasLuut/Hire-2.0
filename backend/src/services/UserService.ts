import { AppDataSource } from "../config/data-source";
import path from "path";
import fs from "fs";
import { Hire, StatusEnum } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { User } from "../models/User";

export class UserService {
  private repo = AppDataSource.getRepository(User);
  private providerRepository = AppDataSource.getRepository(ServiceProvider);
  private hireRepository = AppDataSource.getRepository(Hire);

  async create(data: {
    name: string;
    email: string;
    password: string;
    cpf_cnpj: string;
    acceptedTerms: boolean;
    acceptedAt: Date;
    about?: string;
  }) {
    const exists = await this.repo.findOne({ where: { email: data.email } });
    
    if (exists) throw new Error("Usuário já existente");

    const cpf = data.cpf_cnpj.replace(/[.-]/g, "");

    data.cpf_cnpj = cpf;

    // só os campos do cadastro: papel, verificação de e-mail, suspensão etc. nunca vêm do cliente
    const user = this.repo.create({
      name: String(data.name ?? "").trim(),
      email: String(data.email ?? "").trim(),
      password: data.password,
      cpf_cnpj: data.cpf_cnpj,
      acceptedTerms: data.acceptedTerms === true,
      acceptedAt: data.acceptedAt,
      about: data.about ? String(data.about).slice(0, 400) : (undefined as any),
    });
    await this.repo.save(user);

    const clone: any = { ...user };
    delete clone.password;

    return clone;
  }

  async findAll() {
    const users = await this.repo.find();

    return users.map((u) => {
      const clone: any = { ...u };
      delete clone.password;
      return clone;
    });
  }

  /** Troca a foto do perfil pessoal; apaga o arquivo anterior */
  async setAvatar(id: number, file?: Express.Multer.File) {
    if (!file) throw new Error("Envie uma imagem PNG, JPG, WEBP ou GIF");
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new Error("Usuário não encontrado");
    const old = user.avatarUrl;
    user.avatarUrl = `/uploads/${file.filename}`;
    await this.repo.save(user);
    if (old?.startsWith("/uploads/")) fs.promises.unlink(path.join(__dirname, "..", "..", "uploads", path.basename(old))).catch(() => {});
    return { avatarUrl: user.avatarUrl };
  }

  async findById(id: number) {
    const user = await this.repo.findOne({ where: { id } });

    if (!user) throw new Error("Usuário não encontrado");

    const clone: any = { ...user };
    delete clone.password;
    return clone;
  }

  /**
   * Edição do perfil: só nome e "Sobre". E-mail, CPF, senha e aceite dos termos
   * não mudam por aqui (qualquer outro campo enviado é ignorado).
   */
  async update(id: number, data: { name?: unknown; about?: unknown }) {
    const user = await this.repo.findOne({ where: { id } });

    if (!user) throw new Error("Usuário não encontrado");

    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name || name.length > 50 || !/^[A-Za-zÀ-ÿ\s]+$/.test(name)) {
        throw new Error("Nome deve ter até 50 caracteres, só letras e espaços");
      }
      user.name = name;
    }
    if (data.about !== undefined) {
      user.about = data.about === null ? (null as any) : String(data.about).trim().slice(0, 400);
    }

    return this.repo.save(user);
  }

  /** Preferências da conta (hoje: avisos por e-mail). */
  async updatePreferences(id: number, data: { emailNotifications?: unknown }) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new Error("Usuário não encontrado");
    if (data.emailNotifications !== undefined) user.emailNotifications = data.emailNotifications === true || data.emailNotifications === "true";
    await this.repo.save(user);
    return { emailNotifications: user.emailNotifications };
  }

  async remove(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new Error("Usuário não encontrado");

    const provider = await this.providerRepository.findOne({ where: {
      user: { 
        id: id
      }
    }});

    // Sem prestador, as condições por provider seriam ignoradas pelo TypeORM (id undefined) e
    // bloqueariam a exclusão por contratações de outras pessoas; só as incluímos quando existe prestador.
    const pending = [StatusEnum.EM_ANDAMENTO, StatusEnum.PENDENTE];
    const where: any[] = pending.map((status) => ({ status, user: { id } }));
    if (provider) where.push(...pending.map((status) => ({ status, provider: { id: provider.id } })));

    const hire = await this.hireRepository.findOne({ where });
    if(hire) throw new Error("Usuário não pode ser excluído. Serviço contratado/prestado não foi concluído.");
    
    await this.repo.remove(user);
    return { message: "Usuário removido" };
  }

  async findByEmail(email: string) {
    return this.repo.findOne({
      where: { email },
      select: ["id", "name", "email", "password", "cpf_cnpj", "address", "about", "blocked", "blockedReason"],
    });
  }
}
