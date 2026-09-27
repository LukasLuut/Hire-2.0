import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Conversation } from "./Conversation";
import { User } from "./User";
import { Negotiation } from "./Negotiation";

/** Marco da negociação que a mensagem de sistema registra (vira card na conversa) */
export type MessageEvent =
  | "negotiation.opened"
  | "negotiation.proposal"
  | "negotiation.accepted"
  | "negotiation.formalized"
  | "negotiation.rejected"
  | "negotiation.closed";

export enum MessageRole {
  CLIENT = "cliente",
  PROVIDER = "prestador",
  SYSTEM = "system",
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: "CASCADE" })
  conversation: Conversation;

  // Nulo em mensagens do sistema
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  sender: User | null;

  @Column({ type: "enum", enum: MessageRole })
  role: MessageRole;

  @Column({ type: "text" })
  text: string;

  // Negociação a que a mensagem se refere (mensagens de sistema dos marcos da negociação)
  @ManyToOne(() => Negotiation, { nullable: true, onDelete: "SET NULL" })
  negotiation: Negotiation | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  event: MessageEvent | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  attachmentUrl: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  attachmentName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
