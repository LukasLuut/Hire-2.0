import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";

export const SUPPORT_CATEGORIES = ["conta", "pagamento", "pedido", "tecnico", "sugestao", "outro"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export enum SupportStatus {
  ABERTO = "ABERTO",
  EM_ATENDIMENTO = "EM_ATENDIMENTO",
  RESOLVIDO = "RESOLVIDO",
}

// Chamado de suporte (dúvida, problema técnico, sugestão). Relatos sobre pedidos/perfis ficam em reports.
@Entity("support_tickets")
@Index(["status"])
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "varchar", length: 20 })
  category: SupportCategory;

  @Column({ length: 120 })
  subject: string;

  @Column({ length: 2000 })
  message: string;

  @Column({ type: "varchar", length: 20, default: SupportStatus.ABERTO })
  status: SupportStatus;

  // resposta da administração, vista por quem abriu
  @Column({ type: "varchar", length: 2000, nullable: true })
  reply: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  answeredBy: User | null;

  @Column({ type: "datetime", nullable: true })
  answeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
