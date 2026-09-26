import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "./User";
import { ServiceProvider } from "./ServiceProvider";

// Prestador favorito de um usuário (um registro por par)
@Entity("provider_favorites")
@Unique(["user", "provider"])
export class ProviderFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => ServiceProvider, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  @CreateDateColumn()
  createdAt: Date;
}
