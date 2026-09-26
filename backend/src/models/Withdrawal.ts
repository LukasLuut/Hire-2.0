import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ServiceProvider } from "./ServiceProvider";

/**
 * Saque (simulado) da carteira do prestador para uma chave Pix.
 * SOLICITADO → EM_PROCESSAMENTO → PAGO; ou RECUSADO (com motivo) / CANCELADO (pelo prestador, antes de processar).
 */
export enum WithdrawalStatus {
  SOLICITADO = "SOLICITADO",
  EM_PROCESSAMENTO = "EM_PROCESSAMENTO",
  PAGO = "PAGO",
  RECUSADO = "RECUSADO",
  CANCELADO = "CANCELADO",
}

export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

const money = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity("withdrawals")
@Index(["status"])
export class Withdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ServiceProvider, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  @Column({ type: "decimal", precision: 10, scale: 2, transformer: money })
  amount: number;

  @Column({ type: "varchar", length: 20 })
  pixKeyType: PixKeyType;

  @Column({ length: 120 })
  pixKey: string;

  @Column({ type: "varchar", length: 20, default: WithdrawalStatus.SOLICITADO })
  status: WithdrawalStatus;

  // motivo da recusa (visto pelo prestador)
  @Column({ type: "varchar", length: 300, nullable: true })
  note: string | null;

  // código da transferência simulada
  @Column({ type: "varchar", length: 40, nullable: true })
  transactionCode: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: "datetime", nullable: true })
  processedAt: Date | null;

  @Column({ type: "datetime", nullable: true })
  paidAt: Date | null;
}
