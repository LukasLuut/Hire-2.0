import { AppDataSource } from "../config/data-source";
import { ServiceProvider } from "../models/ServiceProvider";
import { User } from "../models/User";
import { Subcategory } from "../models/Subcategory";
import { Availability } from "../models/Availability";
import { Link } from "../models/Link";

export class ProviderService {
  private providerRepository = AppDataSource.getRepository(ServiceProvider);
  private userRepository = AppDataSource.getRepository(User);
  private subcategoryRepository = AppDataSource.getRepository(Subcategory);
  private linkRepository = AppDataSource.getRepository(Link);
  private availabilityRepository = AppDataSource.getRepository(Availability);

  async create(
    idUser: number,
    data: {
      companyName: string;
      categoryId?: string;
      subcategories?: string;
      links?: string;
      availabilities?: {
        day?: {
          start?: string,
          end?: string
        }
      };
    },
    file?: Express.Multer.File
  ) {
    const profileImageUrl = file ? `/uploads/${file.filename}` : null;

    const user = await this.userRepository.findOne({
      where: { id: idUser },
      relations: { provider: true },
    });
    if (!user) throw new Error("Usuário não existente");
    if (user.provider) throw new Error("Prestador de serviços já existente");

    // Valida os campos em JSON antes de salvar, para não deixar um prestador incompleto no banco
    const subcategories = parseJsonList(data.subcategories);
    const links = parseJsonList(data.links);

    const { categoryId, subcategories: _s, links: _l, availabilities: _a, ...fields } = data as any;
    const newData: any = {
      ...fields,
      user,
      profileImageUrl,
      category: categoryId ? { id: Number(categoryId) } : null,
    };

    const providerSaved = await this.providerRepository.save(
      this.providerRepository.create(newData)
    ) as unknown as ServiceProvider;

    await this.saveRelations(providerSaved, { subcategories, links, availabilities: data.availabilities });

    return providerSaved;
  }

  // Grava subcategorias, links e disponibilidade; com replace, apaga os anteriores antes
  private async saveRelations(
    provider: ServiceProvider,
    rel: { subcategories?: string[]; links?: string[]; availabilities?: Record<string, any> | null },
    replace = false
  ) {
    if (rel.subcategories) {
      if (replace) await this.subcategoryRepository.delete({ provider: { id: provider.id } });
      if (rel.subcategories.length > 0) {
        await this.subcategoryRepository.save(
          rel.subcategories.map((name) => this.subcategoryRepository.create({ name, provider }))
        );
      }
    }

    if (rel.links) {
      if (replace) await this.linkRepository.delete({ provider: { id: provider.id } });
      if (rel.links.length > 0) {
        await this.linkRepository.save(rel.links.map((name) => this.linkRepository.create({ name, provider })));
      }
    }

    if (rel.availabilities) {
      if (replace) await this.availabilityRepository.delete({ provider: { id: provider.id } });
      const availabilities = Object.entries(rel.availabilities)
        .filter(([, value]) => value != null)
        .map(([day, { start, end }]) => this.availabilityRepository.create({ day, start, end, provider }));
      await this.availabilityRepository.save(availabilities);
    }
  }

  async getById(id: number) {
    const provider = await this.providerRepository.findOne({
      relations: {
        user: true,
        subcategories: true,
        links: true,
        category: true,
        availabilities: true,
      },
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Prestador não encontrado");

    return provider;
  }

  async getServices(id: number) {
    const provider = await this.providerRepository.findOne({
      relations: {
        services: {
          category: true,
        },
      },
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Provedor não encontrado");

    return provider.services;
  }

  async remove(id: number) {
    const provider = await this.providerRepository.findOne({
      where: {
        user: {
          id: id,
        },
      },
    });

    if (!provider) throw new Error("Provedor não encontrado");

    await this.providerRepository.remove(provider);
    return { message: "Provedor removido" };
  }

  async list() {
    const users = await this.providerRepository.find();

    return users.map((u) => {
      const clone: any = { ...u };
      delete clone.password;
      return clone;
    });
  }

  async update(id: number, data: any, file?: Express.Multer.File) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: id } },
      relations: { user: true },
    });
    if (!provider) throw new Error("Prestador não encontrado");

    // Listas podem chegar como JSON (multipart) ou já como arrays/objetos (JSON)
    const subcategories = data.subcategories === undefined ? undefined
      : Array.isArray(data.subcategories) ? data.subcategories : parseJsonList(data.subcategories);
    const links = data.links === undefined ? undefined
      : Array.isArray(data.links) ? data.links : parseJsonList(data.links);
    const availabilities = typeof data.availabilities === "string"
      ? JSON.parse(data.availabilities || "null")
      : data.availabilities;

    const {
      categoryId, subcategories: _s, links: _l, availabilities: _a,
      id: _id, user: _u, category: _c, services: _sv, hires: _h, payments: _p, contracts: _ct,
      profileImageUrl: _img, image: _image, ...fields
    } = data;

    Object.assign(provider, fields);
    if (categoryId) provider.category = { id: Number(categoryId) } as any;
    if (file) provider.profileImageUrl = `/uploads/${file.filename}`;

    const saved = await this.providerRepository.save(provider);
    await this.saveRelations(saved, { subcategories, links, availabilities }, true);

    return this.getById(id);
  }
}

// Converte um campo de formulário (string JSON) em lista de strings; vazio ou inválido vira lista vazia
function parseJsonList(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string" && v.trim() !== "") : [];
  } catch {
    throw new Error("Formato inválido em subcategorias ou links");
  }
}
