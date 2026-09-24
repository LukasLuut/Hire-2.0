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

    if (subcategories.length > 0) {
      await this.subcategoryRepository.save(
        subcategories.map((name) => this.subcategoryRepository.create({ name, provider: providerSaved }))
      );
    }

    if (links.length > 0) {
      await this.linkRepository.save(
        links.map((name) => this.linkRepository.create({ name, provider: providerSaved }))
      );
    }

    if (data.availabilities) {
      
       const availabilities = Object.entries(data.availabilities)
        .filter(([, value]) => value != null)
        .map(([day, { start, end }]) =>
          this.availabilityRepository.create({
            day,
            start,
            end,
            provider: providerSaved as any
          })
        );

      await this.availabilityRepository.save(availabilities);
    }


    return providerSaved;
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

  async update(id: number, data: Partial<ServiceProvider> & { categoryId?: number | string }) {
    const user = await this.userRepository.findOne({
      where: { id: id },
      relations: { provider: true },
    });
    if (!user) throw new Error("Usuário não encontrado");

    const provider = await this.providerRepository.findOne({
      where: { user: { id: id } },
      relations: { user: true },
    });
    if (!provider) throw new Error("Provedor não encontrado");

    const { categoryId, ...rest } = data;
    Object.assign(provider, rest);
    if (categoryId) provider.category = { id: Number(categoryId) } as any;

    return await this.providerRepository.save(provider);
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
