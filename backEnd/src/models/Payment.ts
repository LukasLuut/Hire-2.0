import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ServiceProvider } from "./ServiceProvider";
import { User } from "./User";
import { Hire } from "./Hire";

/**
 * Pagamento de uma contratação (simulado: não há cobrança real).
 * PAGO → valor retido pela plataforma até o cliente confirmar a conclusão;
 * LIBERADO → valor líquido disponível para o prestador (base da carteira);
 * ESTORNADO → pedido cancelado depois do pagamento, valor devolvido ao cliente.
 */
export enum PaymentStatus {
  PAGO = "PAGO",
  LIBERADO = "LIBERADO",
  ESTORNADO = "ESTORNADO",
}

export enum PaymentMethod {
  PIX = "pix",
  CARTAO = "cartao",
  BOLETO = "boleto",
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  // valor pago pelo cliente (preço da contratação)
  @Column({ type: "decimal", precision: 10, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  amount: number;

  // taxa da plataforma (percentual e valor) e o que fica para o prestador
  @Column({ type: "decimal", precision: 5, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  feePercent: number;

  @Column({ type: "decimal", precision: 10, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  fee: number;

  @Column({ type: "decimal", precision: 10, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  net: number;

  @Column({ type: "enum", enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PAGO })
  status: PaymentStatus;

  // detalhes da forma de pagamento (cartão: bandeira, final e parcelas; boleto: linha digitável). Nunca o número do cartão.
  @Column({ type: "json", nullable: true })
  details: { brand?: string; last4?: string; installments?: number; barcode?: string } | null;

  // código de transação simulado (aparece no comprovante)
  @Column({ length: 40 })
  transactionCode: string;

  @CreateDateColumn()
  paidAt: Date;

  @Column({ type: "datetime", nullable: true })
  releasedAt: Date | null;

  @Column({ type: "datetime", nullable: true })
  refundedAt: Date | null;

  @OneToOne(() => Hire, (hire) => hire.payment, { onDelete: "CASCADE" })
  @JoinColumn()
  hire: Hire;

  @ManyToOne(() => ServiceProvider, (provider) => provider.payments, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  // quem pagou
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;
}
