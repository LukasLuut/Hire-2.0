import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Service } from "./Service";
import { ServiceProvider } from "./ServiceProvider";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: false })
  name: string;

  @Column({ length: 400, nullable: false })
  description: string;

  // Subcategorias sugeridas (administração): aparecem como opções no cadastro de serviço e como filtro
  @Column({ type: "json", nullable: true })
  subcategories: string[] | null;

  @OneToMany(() => ServiceProvider, (provider) => provider.category)
  providers: ServiceProvider[];

  @OneToMany(() => Service, (service) => service.category)
  services: Service[];

}
