import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Conversation } from "./Conversation";
import { Service } from "./Service";
import { Hire } from "./Hire";
import { Contract } from "./Contract";

export enum NegotiationStatus {
  OPEN = "OPEN",
  FORMALIZED = "FORMALIZED",
  CLOSED = "CLOSED",
}

export enum RequestStatus {
  PENDENTE = "PENDENTE",
  RESPONDIDA = "RESPONDIDA",
  RECUSADA = "RECUSADA",
}

/**
 * De onde a negociação veio:
 * - servico: um serviço já listado pelo prestador;
 * - pedido: o cliente descreveu o que precisa (pedido de orçamento ou proposta dentro do chat);
 * - sob_medida: o prestador montou uma proposta durante a conversa.
 */
export type NegotiationOrigin = "servico" | "pedido" | "sob_medida";
export type Party = "cliente" | "prestador";

// Tópico da negociação (serviço, pagamento, início, duração, finalizar)
export interface NegotiationTopic {
  key: string;
  label: string;
  tooltip?: string;
  state: "Acordado" | "Pendente" | "Negado";
  content: string;
  /** Quem propôs o conteúdo atual; só a outra parte pode marcá-lo como acordado */
  proposedBy?: Party | null;
}

// Pedido do cliente (modal de orçamento ou "Propor" no chat)
export interface QuoteRequest {
  description: string;
  budget: string;
  date: string;
  notes: string;
}

// Uma negociação dentro da conversa do par: tópicos, aceites e, no fim, contratação + contrato
@Entity("negotiations")
@Index("IDX_negotiations_conversation_status", ["conversation", "status"])
export class Negotiation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Conversation, (c) => c.negotiations, { onDelete: "CASCADE" })
  conversation: Conversation;

  @ManyToOne(() => Service, { nullable: true, onDelete: "SET NULL" })
  service: Service | null;

  @ManyToOne(() => Hire, { nullable: true, onDelete: "SET NULL" })
  hire: Hire | null;

  @ManyToOne(() => Contract, { nullable: true, onDelete: "SET NULL" })
  contract: Contract | null;

  @Column({ type: "enum", enum: NegotiationStatus, default: NegotiationStatus.OPEN })
  status: NegotiationStatus;

  @Column({ type: "varchar", length: 20, default: "servico" })
  origin: NegotiationOrigin;

  @Column({ type: "varchar", length: 20, default: "cliente" })
  createdBy: Party;

  @Column({ type: "varchar", length: 120, default: "" })
  title: string;

  @Column({ type: "json", nullable: true })
  topics: NegotiationTopic[] | null;

  @Column({ type: "json", nullable: true })
  request: QuoteRequest | null;

  @Column({ type: "enum", enum: RequestStatus, nullable: true })
  requestStatus: RequestStatus | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  rejectReason: string | null;

  // Quem encerrou sem acordo e por quê
  @Column({ type: "varchar", length: 20, nullable: true })
  closedBy: Party | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  closeReason: string | null;

  // Aceite final de cada parte; os dois aceites geram contratação + contrato
  @Column({ type: "datetime", nullable: true })
  clientAcceptedAt: Date | null;

  @Column({ type: "datetime", nullable: true })
  providerAcceptedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
