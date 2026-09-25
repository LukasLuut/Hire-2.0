import { AppDataSource } from "../config/data-source";
import { Review, ReviewDirection } from "../models/Review";
import { Hire, StatusEnum } from "../models/Hire";

export interface RatingStats {
  average: number;
  count: number;
}

const EMPTY: RatingStats = { average: 0, count: 0 };

// Notas médias e contagens calculadas a partir das avaliações reais
export class StatsService {
  private reviewRepository = AppDataSource.getRepository(Review);
  private hireRepository = AppDataSource.getRepository(Hire);

  private async grouped(column: "providerId" | "serviceId" | "targetId", ids: number[], direction?: ReviewDirection) {
    const map = new Map<number, RatingStats>();
    if (ids.length === 0) return map;
    const qb = this.reviewRepository
      .createQueryBuilder("r")
      .select(`r.${column}`, "id")
      .addSelect("AVG(r.rating)", "average")
      .addSelect("COUNT(r.id)", "count")
      .where(`r.${column} IN (:...ids)`, { ids })
      .groupBy(`r.${column}`);
    if (direction) qb.andWhere("r.direction = :direction", { direction });
    const rows = await qb.getRawMany();
    for (const row of rows) {
      map.set(Number(row.id), { average: Math.round(Number(row.average) * 10) / 10, count: Number(row.count) });
    }
    return map;
  }

  /** Nota dos prestadores (avaliações feitas pelos clientes). */
  async forProviders(ids: number[]) {
    return this.grouped("providerId", ids, ReviewDirection.CLIENT_TO_PROVIDER);
  }

  /** Nota dos serviços (avaliações feitas pelos clientes naquele serviço). */
  async forServices(ids: number[]) {
    return this.grouped("serviceId", ids, ReviewDirection.CLIENT_TO_PROVIDER);
  }

  /** Nota de um usuário como cliente (avaliações feitas pelos prestadores). */
  async forClient(userId: number): Promise<RatingStats> {
    const map = await this.grouped("targetId", [userId], ReviewDirection.PROVIDER_TO_CLIENT);
    return map.get(userId) ?? EMPTY;
  }

  /** Quantidade de serviços concluídos por prestador (base do "nível"). */
  async completedHires(providerIds: number[]) {
    const map = new Map<number, number>();
    if (providerIds.length === 0) return map;
    const rows = await this.hireRepository
      .createQueryBuilder("h")
      .select("h.providerId", "id")
      .addSelect("COUNT(h.id)", "count")
      .where("h.providerId IN (:...ids)", { ids: providerIds })
      .andWhere("h.status = :status", { status: StatusEnum.CONCLUIDO })
      .groupBy("h.providerId")
      .getRawMany();
    for (const row of rows) map.set(Number(row.id), Number(row.count));
    return map;
  }

  static level(completed: number) {
    if (completed >= 20) return "Especialista";
    if (completed >= 5) return "Intermediário";
    return "Iniciante";
  }

  static empty(): RatingStats {
    return { ...EMPTY };
  }
}

export const statsService = new StatsService();
