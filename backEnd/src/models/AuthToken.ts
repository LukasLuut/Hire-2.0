import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";

// Token de uso único enviado por e-mail (confirmar e-mail ou redefinir senha).
// Guardamos só o hash SHA-256: quem ler o banco não consegue usar o link.
@Entity("auth_tokens")
export class AuthToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column({ length: 20 })
  type: "verify" | "reset";

  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash: string;

  @Column({ type: "datetime" })
  expiresAt: Date;

  @Column({ type: "datetime", nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
