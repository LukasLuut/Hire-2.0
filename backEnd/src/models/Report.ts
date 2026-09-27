import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Hire } from "./Hire";
import { ServiceProvider } from "./ServiceProvider";

export const REPORT_REASONS = ["nao_compareceu", "servico_ruim", "cobranca", "comportamento", "fraude", "outro"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export enum ReportStatus {
  ABERTA = "ABERTA",
  RESOLVIDA = "RESOLVIDA",
  DESCARTADA = "DESCARTADA",
}

// Problema relatado por um usuário sobre uma contratação ou um perfil de prestador
@Entity("reports")
@Index(["status"])
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  reporter: User;

  // contratação em disputa (quando o relato é sobre um pedido)
  @ManyToOne(() => Hire, { nullable: true, onDelete: "SET NULL" })
  hire: Hire | null;

  // perfil denunciado (quando o relato é sobre um prestador, sem pedido)
  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: "SET NULL" })
  provider: ServiceProvider | null;

  @Column({ type: "varchar", length: 30 })
  reason: ReportReason;

  @Column({ type: "varchar", length: 1000 })
  description: string;

  // nomes dos arquivos em armazenamento privado (fora de /uploads)
  @Column({ type: "json", nullable: true })
  files: string[] | null;

  @Column({ type: "varchar", length: 20, default: ReportStatus.ABERTA })
  status: ReportStatus;

  // decisão da administração, vista por quem relatou
  @Column({ type: "varchar", length: 500, nullable: true })
  resolution: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  resolvedBy: User | null;

  @Column({ type: "datetime", nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
