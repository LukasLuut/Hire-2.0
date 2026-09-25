import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./User";
import { Hire } from "./Hire";
import { ServiceProvider } from "./ServiceProvider";
import { Service } from "./Service";
import { ReviewPhoto } from "./ReviewPhoto";

// Avaliação mútua: o cliente avalia o prestador e o prestador avalia o cliente,
// uma vez por contratação concluída.
export enum ReviewDirection {
  CLIENT_TO_PROVIDER = "CLIENT_TO_PROVIDER",
  PROVIDER_TO_CLIENT = "PROVIDER_TO_CLIENT",
}

@Entity("reviews")
@Unique(["hire", "direction"])
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "tinyint" })
  rating: number;

  @Column({ type: "text", nullable: true })
  comment: string | null;

  @Column({ type: "enum", enum: ReviewDirection })
  direction: ReviewDirection;

  // Quem escreveu
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  author: User;

  // Quem foi avaliado (o usuário cliente ou o usuário dono do perfil de prestador)
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  target: User;

  // Preenchido quando o avaliado é o prestador: facilita a nota do perfil e dos serviços
  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: "CASCADE" })
  provider: ServiceProvider | null;

  @ManyToOne(() => Service, { nullable: true, onDelete: "SET NULL" })
  service: Service | null;

  @ManyToOne(() => Hire, { onDelete: "CASCADE" })
  hire: Hire;

  @OneToMany(() => ReviewPhoto, (photo) => photo.review, { cascade: true })
  photos: ReviewPhoto[];

  @CreateDateColumn()
  createdAt: Date;
}
