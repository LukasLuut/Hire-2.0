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

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
