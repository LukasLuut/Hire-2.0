import { AppDataSource } from "../config/data-source";
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
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      direction: r.direction,
      createdAt: r.createdAt,
      hireId: r.hire?.id,
      service: r.service ? { id: r.service.id, title: r.service.title } : null,
      author: r.author ? { id: r.author.id, name: r.author.name } : null,
      photos: (r.photos ?? []).map((p) => ({ id: p.id, url: p.url })),
    };
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
