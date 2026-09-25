import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Conversation } from "./Conversation";
import { User } from "./User";

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

  @Column({ type: "varchar", length: 255, nullable: true })
  attachmentUrl: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  attachmentName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
