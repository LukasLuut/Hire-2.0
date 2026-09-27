import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { ServiceProvider } from "./ServiceProvider";
import { Message } from "./Message";
import { Negotiation } from "./Negotiation";

export { NegotiationStatus, RequestStatus } from "./Negotiation";
export type { NegotiationTopic, QuoteRequest } from "./Negotiation";

/**
 * Conversa entre um cliente e um prestador: uma só por par, nunca fecha.
 * As negociações (tópicos, aceites, contrato) acontecem dentro dela, uma de cada vez ou várias.
 */
@Entity("conversations")
@Index("IDX_conversations_pair", ["client", "provider"], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  client: User;

  @ManyToOne(() => ServiceProvider, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => Negotiation, (n) => n.conversation)
  negotiations: Negotiation[];

  // Ordena a lista de conversas sem consultar as mensagens
  @Index("IDX_conversations_last_message")
  @Column({ type: "datetime", precision: 6, nullable: true })
  lastMessageAt: Date | null;

  // Até quando cada parte leu (mensagens depois disso contam como não lidas)
  @Column({ type: "datetime", precision: 6, nullable: true })
  clientLastReadAt: Date | null;

  @Column({ type: "datetime", precision: 6, nullable: true })
  providerLastReadAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
