import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Métricas de aquisição agregadas por dia (LGPD: sem IP, sem usuário, sem cookie).
 * Uma linha por dia + evento + prestador + serviço + origem, com a contagem.
 */
@Entity("analytics_daily")
@Index(["day", "event", "providerId", "serviceId", "source"], { unique: true })
@Index(["providerId", "day"])
export class AnalyticsDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  day: string;

  // ex.: profile_view, service_view, quote_click, share_click...
  @Column({ length: 40 })
  event: string;

  // 0 = sem prestador (evita NULL no índice único)
  @Column({ type: "int", default: 0 })
  providerId: number;

  @Column({ type: "int", default: 0 })
  serviceId: number;

  // de onde veio a visita: direct, link, whatsapp, qr, invite, search...
  @Column({ length: 20, default: "direct" })
  source: string;

  @Column({ type: "int", default: 0 })
  count: number;
}
