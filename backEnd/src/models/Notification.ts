import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";

// Aviso para um usuário sobre algo que aconteceu (pedido novo, proposta, entrega, contrato...)
@Entity("notifications")
@Index(["user", "read"])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  // tipo do evento, ex.: "hire.requested", "quote.responded", "contract.ready"
  @Column({ length: 40 })
  type: string;

  @Column({ length: 120 })
  title: string;

  @Column({ length: 300, default: "" })
  body: string;

  // caminho do frontend que resolve o aviso, ex.: "/negotiation/12"
  @Column({ length: 120, default: "" })
  link: string;

  @Column({ default: false })
  read: boolean;

  // e-mail já enviado para este aviso (usado pelos avisos por e-mail)
  @Column({ default: false })
  emailed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
