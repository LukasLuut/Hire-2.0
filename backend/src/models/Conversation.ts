import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { ServiceProvider } from "./ServiceProvider";
import { Service } from "./Service";
import { Hire } from "./Hire";
import { Contract } from "./Contract";
import { Message } from "./Message";

export enum ConversationStatus {
  OPEN = "OPEN",
  FORMALIZED = "FORMALIZED",
  CLOSED = "CLOSED",
}

// Tópico da negociação (serviço, pagamento, início, duração, finalização)
export interface NegotiationTopic {
  key: string;
  label: string;
  tooltip?: string;
  state: "Acordado" | "Pendente" | "Negado";
  content: string;
  /** Quem propôs o conteúdo atual; só a outra parte pode marcá-lo como acordado */
  proposedBy?: "cliente" | "prestador" | null;
}

export enum RequestStatus {
  PENDENTE = "PENDENTE",
  RESPONDIDA = "RESPONDIDA",
  RECUSADA = "RECUSADA",
}

// Pedido de orçamento enviado pelo cliente (modal "Iniciar negociação")
export interface QuoteRequest {
  description: string;
  budget: string;
  date: string;
  notes: string;
}

// Conversa/negociação entre um cliente e um prestador, opcionalmente sobre um serviço
@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  client: User;

  @ManyToOne(() => ServiceProvider, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  @ManyToOne(() => Service, { nullable: true, onDelete: "SET NULL" })
  service: Service | null;

  @ManyToOne(() => Hire, { nullable: true, onDelete: "SET NULL" })
  hire: Hire | null;

  @ManyToOne(() => Contract, { nullable: true, onDelete: "SET NULL" })
  contract: Contract | null;

  @Column({ type: "enum", enum: ConversationStatus, default: ConversationStatus.OPEN })
  status: ConversationStatus;

  @Column({ type: "json", nullable: true })
  topics: NegotiationTopic[] | null;

  @Column({ type: "json", nullable: true })
  request: QuoteRequest | null;

  @Column({ type: "enum", enum: RequestStatus, nullable: true })
  requestStatus: RequestStatus | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  rejectReason: string | null;

  // Quem encerrou a negociação sem acordo e por quê (ex.: cliente recusou a proposta)
  @Column({ type: "varchar", length: 20, nullable: true })
  closedBy: "cliente" | "prestador" | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  closeReason: string | null;

  // Aceite final do acordo por cada parte; os dois aceites geram contratação + contrato
  @Column({ type: "datetime", nullable: true })
  clientAcceptedAt: Date | null;

  @Column({ type: "datetime", nullable: true })
  providerAcceptedAt: Date | null;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
