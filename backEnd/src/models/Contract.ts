import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ServiceProvider } from "./ServiceProvider";
import { Hire } from "./Hire";
import { User } from "./User";

export interface ContractSignature {
  name: string;
  signedAt: string;
  userAgent: string;
  ip?: string | null;
  geolocation?: { latitude: number; longitude: number } | null;
  hash: string;
}

@Entity("contracts")
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: false })
  code: string;

  @Column({ type: "date" })
  firstContact: Date;

  @Column({ type: "date" })
  lastContact: Date;

  @Column({ type: "double" })
  price: number;

  @Column({ length: 100, nullable: false })
  description_service: string;

  @ManyToOne(() => ServiceProvider, (provider) => provider.contracts)
  provider: ServiceProvider;

  @ManyToOne(() => Hire, (hire) => hire.contracts)
  hire: Hire;

  @ManyToOne(() => User, (user) => user.contracts)
  user: User;

  // Assinatura eletrônica de cada parte (nome digitado, data, navegador, hash do documento)
  @Column({ type: "json", nullable: true })
  clientSignature: ContractSignature | null;

  @Column({ type: "json", nullable: true })
  providerSignature: ContractSignature | null;

}
