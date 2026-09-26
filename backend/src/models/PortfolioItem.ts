import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ServiceProvider } from "./ServiceProvider";
import { Service } from "./Service";

// Trabalho realizado mostrado no perfil público do prestador (foto + título + descrição)
@Entity("portfolio_items")
@Index(["provider", "position"])
export class PortfolioItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ServiceProvider, { onDelete: "CASCADE" })
  provider: ServiceProvider;

  // serviço relacionado (opcional); se o serviço for excluído, o item continua
  @ManyToOne(() => Service, { nullable: true, onDelete: "SET NULL" })
  service: Service | null;

  @Column({ length: 255 })
  imageUrl: string;

  @Column({ length: 80 })
  title: string;

  @Column({ length: 300, default: "" })
  description: string;

  // ordem de exibição (0 = primeiro)
  @Column({ type: "int", default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;
}
