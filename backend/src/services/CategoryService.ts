import { AppDataSource } from "../config/data-source";
import { Category } from "../models/Category";
import { Service } from "../models/Service";
import { ServiceProvider } from "../models/ServiceProvider";

export class CategoryService {
  private categoryRepository = AppDataSource.getRepository(Category);

  async create(data: { name: string; description: string }) {
    const exists = await this.categoryRepository.findOne({
      where: { name: data.name },
    });

    if (exists) throw new Error("Categoria já existente");

    const category = this.categoryRepository.create(data);
    return await this.categoryRepository.save(category);
  }

  async list() {
    return await this.categoryRepository.find();
  }

  async update(id: number, data: Partial<Category>) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) throw new Error("Categoria não encontrada");
    // só nome e descrição são editáveis
    if (typeof data.name === "string" && data.name.trim()) category.name = data.name.trim();
    if (typeof data.description === "string") category.description = data.description.trim();
    return await this.categoryRepository.save(category);
  }

  async remove(id: number) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) throw new Error("Categoria não encontrada");

    // categorias em uso não são excluídas (serviços e prestadores apontam para elas)
    const [services, providers] = await Promise.all([
      AppDataSource.getRepository(Service).count({ where: { category: { id } } }),
      AppDataSource.getRepository(ServiceProvider).count({ where: { category: { id } } }),
    ]);
    if (services || providers) {
      throw new Error(`Categoria em uso por ${services} serviço(s) e ${providers} prestador(es). Mova-os antes de excluir.`);
    }

    await this.categoryRepository.remove(category);

    return { message: "Categoria removida com sucesso" };
  }

  async getById(id: number){
    const category = await this.categoryRepository.findOne({ where: { id }});

    if(!category) throw new Error("Categoria não encontrada");

    return category;
  }
}
