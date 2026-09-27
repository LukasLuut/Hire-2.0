import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";

/**
 * Convite com código rastreável. Diferente de compartilhar uma página:
 * o convite atribui o cadastro (User.invite) e a conversão (User.inviteConvertedAt).
 * kind = quem está sendo convidado; inviterRole = papel de quem convidou.
 * Juntos cobrem cliente→cliente, cliente→prestador, prestador→prestador e prestador→cliente.
 * Não há recompensa: as conversões ficam registradas para uma regra futura.
 */
@Entity("invites")
@Index(["inviter", "kind", "context"])
export class Invite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 16, unique: true })
  code: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  inviter: User;

  @Column({ type: "varchar", length: 10 })
  kind: "provider" | "client";

  @Column({ type: "varchar", length: 10 })
  inviterRole: "cliente" | "prestador";

  // necessidade que motivou o convite, ex.: "Eletricista em São Leopoldo"
  @Column({ type: "varchar", length: 120, default: "" })
  context: string;

  @CreateDateColumn()
  createdAt: Date;
}
