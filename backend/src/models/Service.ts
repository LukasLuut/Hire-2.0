import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ServiceProvider } from "./ServiceProvider";
import { Category } from "./Category";
import { Hire } from "./Hire";

@Entity("services")
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: false })
  title: string;

  @Column({ length: 250, nullable: false })
  description_service: string;

  @Column()
  negotiable: boolean;

  @Column()
  requiresScheduling: boolean;

  @Column({ type: "double", nullable: false })
  price: number;

  @Column({ length: 100, nullable: false })
  duration: string;

  @Column({ length: 200, default: "Has no subcategory" })
  subcategory?: string;

  @Column({ default: 0 })
  likesNumber?: number;

  // Pausado = some da vitrine e do perfil público e não recebe pedidos novos
  @Column({ default: true })
  active: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  imageUrl?: string | null;

  // Todas as imagens na ordem escolhida pelo prestador; a primeira é a capa (imageUrl)
  @Column({ type: "json", nullable: true })
  images?: string[] | null;

  // Agenda do serviço: horários de início por dia da semana, ex.: { "monday": ["08:00", "10:00"] }
  @Column({ type: "json", nullable: true })
  scheduleSlots?: Record<string, string[]> | null;

  // Antecedência mínima para cancelar um horário agendado, ex.: "até 24h antes"
  @Column({ type: "varchar", length: 100, nullable: true })
  cancellationNotice?: string | null;

  @ManyToOne(() => ServiceProvider, (provider) => provider.services, {
    onDelete: "CASCADE",
  })
  @JoinColumn()
  provider: ServiceProvider;

  @ManyToOne(() => Category, (category) => category.services, {
  nullable: false,
  })
  @JoinColumn({ name: "category_id" })
  category: Category;


  @OneToMany(() => Hire, (hire) => hire.service)
  hires: Hire[];
}
