import { AppDataSource } from "../config/data-source";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";
import { Review, ReviewDirection } from "../models/Review";
import { ReviewPhoto } from "../models/ReviewPhoto";
import { Hire, StatusEnum } from "../models/Hire";
import { statsService } from "./StatsService";

const MAX_PHOTOS = 5;

export class ReviewService {
  private reviewRepository = AppDataSource.getRepository(Review);
  private hireRepository = AppDataSource.getRepository(Hire);

  private readonly listRelations = { author: true, photos: true, service: true, hire: true } as const;

  // Formato enviado ao frontend (sem dados sensíveis do autor)
  private present(r: Review) {
    const hidden = !!r.hiddenAt;
    return {
      id: r.id,
      rating: r.rating,
      // oculto pela moderação: a nota fica, o texto e as fotos não
      comment: hidden ? null : r.comment,
      moderated: hidden,
      direction: r.direction,
      createdAt: r.createdAt,
      hireId: r.hire?.id,
      service: r.service ? { id: r.service.id, title: r.service.title } : null,
      author: r.author ? { id: r.author.id, name: r.author.name } : null,
      photos: hidden ? [] : (r.photos ?? []).map((p) => ({ id: p.id, url: p.url })),
    };
  }

  /** Administração: avaliações recentes (com texto original) para moderar. */
  async adminList(opts: { q?: string; hidden?: boolean } = {}) {
    const qb = this.reviewRepository
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.author", "a")
      .leftJoinAndSelect("r.target", "t")
      .leftJoinAndSelect("r.provider", "p")
      .leftJoinAndSelect("r.service", "s")
      .leftJoinAndSelect("r.photos", "ph")
      .orderBy("r.id", "DESC")
      .take(100);
    if (opts.hidden) qb.andWhere("r.hiddenAt IS NOT NULL");
    const q = String(opts.q ?? "").trim();
    if (q) qb.andWhere("(r.comment LIKE :q OR a.name LIKE :q OR t.name LIKE :q OR p.companyName LIKE :q)", { q: `%${q}%` });
    const list = await qb.getMany();
    return list.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      direction: r.direction,
      createdAt: r.createdAt,
      hiddenAt: r.hiddenAt,
      hiddenReason: r.hiddenReason,
      author: r.author ? { id: r.author.id, name: r.author.name } : null,
      target: r.provider ? { name: r.provider.companyName || r.provider.professionalName } : r.target ? { name: r.target.name } : null,
      service: r.service ? { id: r.service.id, title: r.service.title } : null,
      photos: (r.photos ?? []).map((p) => ({ id: p.id, url: p.url })),
    }));
  }

  /** Oculta (com motivo) ou volta a mostrar o comentário; quem escreveu é avisado ao ocultar. */
  async moderate(id: number, hidden: boolean, reason?: unknown) {
    const review = await this.reviewRepository.findOne({ where: { id }, relations: { author: true } });
    if (!review) throw new HttpError(404, "Avaliação não encontrada");
    const clean = String(reason ?? "").trim().slice(0, 300);
    if (hidden && clean.length < 5) throw new HttpError(400, "Explique o motivo da moderação");
    review.hiddenAt = hidden ? new Date() : null;
    review.hiddenReason = hidden ? clean : null;
    await this.reviewRepository.save(review);
    if (hidden) {
      await notificationService.notify(review.author?.id, {
        type: "review.moderated",
        title: "Seu comentário foi ocultado",
        body: `A nota continua valendo, mas o texto saiu do ar. Motivo: ${clean}`,
        link: "/ajuda",
      });
    }
    return { id: review.id, hiddenAt: review.hiddenAt, hiddenReason: review.hiddenReason };
  }

  async create(
    userId: number,
    data: { hireId?: string | number; rating?: string | number; comment?: string },
    files: Express.Multer.File[] = []
  ) {
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("A nota deve ser de 1 a 5 estrelas");
    if (files.length > MAX_PHOTOS) throw new Error(`Envie no máximo ${MAX_PHOTOS} fotos`);

    const hire = await this.hireRepository.findOne({
      where: { id: Number(data.hireId) },
      relations: { user: true, provider: { user: true }, service: true },
    });
    if (!hire) throw new Error("Contratação não encontrada");
    if (hire.status !== StatusEnum.CONCLUIDO) throw new Error("Só é possível avaliar depois que o serviço for concluído");
    if (hire.disputed) throw new Error("As avaliações deste pedido ficam bloqueadas enquanto o problema relatado está em análise");

    const isClient = hire.user?.id === userId;
    const isProvider = hire.provider?.user?.id === userId;
    if (!isClient && !isProvider) throw new Error("Você não participou desta contratação");

    const direction = isClient ? ReviewDirection.CLIENT_TO_PROVIDER : ReviewDirection.PROVIDER_TO_CLIENT;
    const exists = await this.reviewRepository.findOne({ where: { hire: { id: hire.id }, direction } });
    if (exists) throw new Error("Você já avaliou esta contratação");

    const review = this.reviewRepository.create({
      rating,
      comment: data.comment?.trim() || null,
      direction,
      author: { id: userId },
      target: isClient ? { id: hire.provider.user.id } : { id: hire.user.id },
      provider: isClient ? { id: hire.provider.id } : null,
      service: hire.service ? { id: hire.service.id } : null,
      hire: { id: hire.id },
      photos: files.map((f) => Object.assign(new ReviewPhoto(), { url: `/uploads/${f.filename}` })),
    });
    const saved = await this.reviewRepository.save(review);
    await notificationService.notify(isClient ? hire.provider.user.id : hire.user.id, {
      type: "review.received",
      title: `Nova avaliação: ${rating}★`,
      body: data.comment?.trim()?.slice(0, 140) || "Você recebeu uma avaliação.",
      link: isClient ? "/business" : "/home",
    });
    const full = await this.reviewRepository.findOne({ where: { id: saved.id }, relations: this.listRelations });
    return this.present(full!);
  }

  /** Avaliações que o prestador recebeu dos clientes, com resumo. */
  async listForProvider(providerId: number) {
    const reviews = await this.reviewRepository.find({
      where: { provider: { id: providerId }, direction: ReviewDirection.CLIENT_TO_PROVIDER },
      relations: this.listRelations,
      order: { createdAt: "DESC" },
    });
    const stats = (await statsService.forProviders([providerId])).get(providerId) ?? { average: 0, count: 0 };
    return { ...stats, reviews: reviews.map((r) => this.present(r)) };
  }

  /** Avaliações que um usuário recebeu como cliente (feitas por prestadores), com resumo. */
  async listForClient(userId: number) {
    const reviews = await this.reviewRepository.find({
      where: { target: { id: userId }, direction: ReviewDirection.PROVIDER_TO_CLIENT },
      relations: this.listRelations,
      order: { createdAt: "DESC" },
    });
    const stats = await statsService.forClient(userId);
    return { ...stats, reviews: reviews.map((r) => this.present(r)) };
  }

  /** Avaliações de uma contratação (para saber quem já avaliou). */
  async listForHire(hireId: number) {
    const reviews = await this.reviewRepository.find({
      where: { hire: { id: hireId } },
      relations: this.listRelations,
    });
    return reviews.map((r) => this.present(r));
  }
}

export const reviewService = new ReviewService();
