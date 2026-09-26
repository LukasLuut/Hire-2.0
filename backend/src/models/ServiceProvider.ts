import {
  ChildEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Service } from "./Service";
import { Category } from "./Category";
import { Contract } from "./Contract";
import { Hire } from "./Hire";
import { Payment } from "./Payment";
import { Subcategory } from "./Subcategory";
import { Availability } from "./Availability";
import { Link } from "./Link";

export enum VerificationStatus {
  NONE = "none",
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

export type VerificationFile = { kind: "id" | "cert"; name: string };

@Entity("service_providers")
export class ServiceProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, nullable: false })
  professionalName: string;

  @Column({ length: 100, nullable: false })
  companyName: string;

  @OneToOne(() => User, (user) => user.provider, {
    onDelete: "CASCADE",
  })
  @JoinColumn()
  user: User;
  
  @Column()
  professionalEmail: string;

  @Column() 
  professionalPhone: string;

  @Column({ default: false })
  attendsPresent: boolean

  @Column({ default: false })
  attendsOnline: boolean

  // ESSAS SÃO TESTES  
  @Column({ default: false })
  personalizedProposals: boolean

  @Column({ default: false })
  approximateLocation: boolean

  @Column({ default: false })
  publicReviews: boolean

  @Column({ default: false })
  pricesOnPage: boolean

  @Column({ default: false })
  whatsNotification: boolean

  @Column({ default: false })
  emailNotification: boolean

  @Column({ default: "available"})
  status?: string;

  @Column({ length: 400, nullable: true })
  onlineLink?: string

  // Área de atendimento presencial: cidade base, ponto no mapa e raio em km
  @Column({ type: "varchar", length: 80, nullable: true })
  baseCity?: string | null;

  @Column({ type: "varchar", length: 2, nullable: true })
  baseState?: string | null;

  @Column({ type: "double", nullable: true })
  latitude?: number | null;

  @Column({ type: "double", nullable: true })
  longitude?: number | null;

  @Column({ type: "int", default: 20 })
  serviceRadiusKm: number;

  @Column({ length: 255, nullable: true })
  description?: string

  @Column({ length: 18, nullable: true})
  cnpj?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  profileImageUrl?: string | null;

  // Verificação: documentos em armazenamento privado, revisão manual e selo no perfil
  @Column({ type: "varchar", length: 20, default: "none" })
  verificationStatus: VerificationStatus;

  // arquivos privados aguardando análise (não saem nas consultas públicas)
  @Column({ type: "json", nullable: true, select: false })
  verificationFiles?: VerificationFile[] | null;

  // motivo da recusa, visto só pelo prestador e pela administração
  @Column({ type: "varchar", length: 300, nullable: true, select: false })
  verificationNote?: string | null;

  @Column({ type: "datetime", nullable: true })
  verifiedAt?: Date | null;

  @OneToMany(() => Subcategory, (subcategory) => subcategory.provider)
  subcategories: Subcategory[];

  @OneToMany(() => Link, (link) => link.provider)
  links: Link[];

  @OneToMany(() => Availability, (availability) => availability.provider)
  availabilities: Availability[];

  @OneToMany(() => Contract, (contract) => contract.provider)
  contracts: Contract[];

  @ManyToOne(() => Category, (category) => category.providers, { nullable: true })
  @JoinColumn()
  category: Category;

  @OneToMany(() => Service, (service) => service.provider)
  services: Service[];

  @OneToMany(() => Hire, (hire) => hire.provider)
  hires: Hire[];

  @OneToMany(() => Payment, (payment) => payment.provider)
  payments: Payment[];
}
