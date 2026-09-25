import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "./User";
import { Service } from "./Service";

// Curtida de um usuário em um serviço (uma por usuário)
@Entity("service_likes")
@Unique(["user", "service"])
export class ServiceLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Service, { onDelete: "CASCADE" })
  service: Service;

  @CreateDateColumn()
  createdAt: Date;
}
