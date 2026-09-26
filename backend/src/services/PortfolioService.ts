import fs from "fs";
import path from "path";
import { AppDataSource } from "../config/data-source";
import { PortfolioItem } from "../models/PortfolioItem";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { HttpError } from "./HireService";

export const MAX_PORTFOLIO_ITEMS = 30;
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

/* Portfólio do prestador: itens com foto, título, descrição e serviço relacionado, em ordem. */
export class PortfolioService {
  private items = AppDataSource.getRepository(PortfolioItem);
  private providers = AppDataSource.getRepository(ServiceProvider);
  private services = AppDataSource.getRepository(Service);

  present(i: PortfolioItem) {
    return {
      id: i.id,
      imageUrl: i.imageUrl,
      title: i.title,
      description: i.description,
      position: i.position,
      service: i.service ? { id: i.service.id, title: i.service.title } : null,
    };
  }

  /** Lista em ordem (pública: usada no perfil) */
  async list(providerId: number) {
    const rows = await this.items.find({ where: { provider: { id: providerId } }, relations: { service: true }, order: { position: "ASC", id: "ASC" } });
    return rows.map((i) => this.present(i));
  }

  private async providerOf(userId: number) {
    const p = await this.providers.findOne({ where: { user: { id: userId } }, select: { id: true } });
    if (!p) throw new HttpError(404, "Cadastre sua empresa primeiro");
    return p;
  }

  private async own(userId: number, itemId: number) {
    const p = await this.providerOf(userId);
    const item = await this.items.findOne({ where: { id: itemId, provider: { id: p.id } }, relations: { service: true } });
    if (!item) throw new HttpError(404, "Item do portfólio não encontrado");
    return { p, item };
  }

  /** Serviço relacionado precisa ser do próprio prestador */
  private async serviceFor(providerId: number, serviceId: unknown) {
    if (serviceId === undefined || serviceId === null || serviceId === "" || serviceId === "null") return null;
    const s = await this.services.findOne({ where: { id: Number(serviceId), provider: { id: providerId } }, select: { id: true, title: true } });
    if (!s) throw new HttpError(400, "Escolha um dos seus serviços");
    return s;
  }

  private texts(data: { title?: unknown; description?: unknown }, partial = false) {
    const out: { title?: string; description?: string } = {};
    if (data.title !== undefined || !partial) {
      const title = String(data.title ?? "").trim();
      if (!title) throw new HttpError(400, "Dê um título ao trabalho");
      out.title = title.slice(0, 80);
    }
    if (data.description !== undefined) out.description = String(data.description ?? "").trim().slice(0, 300);
    return out;
  }

  private removeFile(url: string | null | undefined) {
    if (!url?.startsWith("/uploads/")) return;
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  }

  async create(userId: number, data: Record<string, unknown>, file?: Express.Multer.File) {
    try {
      if (!file) throw new HttpError(400, "Envie uma foto do trabalho");
      const p = await this.providerOf(userId);
      const count = await this.items.count({ where: { provider: { id: p.id } } });
      if (count >= MAX_PORTFOLIO_ITEMS) throw new HttpError(400, `O portfólio aceita até ${MAX_PORTFOLIO_ITEMS} trabalhos`);
      const texts = this.texts(data);
      const service = await this.serviceFor(p.id, data.serviceId);
      const saved = await this.items.save(
        this.items.create({ provider: { id: p.id }, service, imageUrl: `/uploads/${file.filename}`, title: texts.title!, description: texts.description ?? "", position: count })
      );
      return this.present({ ...saved, service } as PortfolioItem);
    } catch (e) {
      if (file) this.removeFile(`/uploads/${file.filename}`);
      throw e;
    }
  }

  async update(userId: number, itemId: number, data: Record<string, unknown>, file?: Express.Multer.File) {
    try {
      const { p, item } = await this.own(userId, itemId);
      Object.assign(item, this.texts(data, true));
      if (data.serviceId !== undefined) item.service = await this.serviceFor(p.id, data.serviceId);
      if (file) {
        this.removeFile(item.imageUrl);
        item.imageUrl = `/uploads/${file.filename}`;
      }
      await this.items.save(item);
      return this.present(item);
    } catch (e) {
      if (file) this.removeFile(`/uploads/${file.filename}`);
      throw e;
    }
  }

  async remove(userId: number, itemId: number) {
    const { p, item } = await this.own(userId, itemId);
    await this.items.remove(item);
    this.removeFile(item.imageUrl);
    // mantém as posições contínuas
    const rest = await this.items.find({ where: { provider: { id: p.id } }, order: { position: "ASC", id: "ASC" } });
    await Promise.all(rest.map((r, i) => (r.position === i ? null : this.items.update(r.id, { position: i }))));
    return { ok: true };
  }

  /** Nova ordem: lista com todos os ids do prestador */
  async reorder(userId: number, ids: unknown) {
    const p = await this.providerOf(userId);
    const current = await this.items.find({ where: { provider: { id: p.id } }, select: { id: true } });
    const list = Array.isArray(ids) ? ids.map(Number) : [];
    const mine = new Set(current.map((c) => c.id));
    if (list.length !== mine.size || !list.every((id) => mine.has(id)) || new Set(list).size !== list.length) {
      throw new HttpError(400, "Ordem inválida");
    }
    await Promise.all(list.map((id, position) => this.items.update(id, { position })));
    return this.list(p.id);
  }

  async mine(userId: number) {
    const p = await this.providerOf(userId);
    return this.list(p.id);
  }
}

export const portfolioService = new PortfolioService();
