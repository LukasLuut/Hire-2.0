import {
  CreateDateColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ServiceProvider } from "./ServiceProvider";
import { Service } from "./Service";
import { User } from "./User";
import { Payment } from "./Payment";
import { Contract } from "./Contract";

export enum StatusEnum {
  PENDENTE = "PENDENTE",
  // só em status_provider: o prestador aceitou o pedido e ainda não começou
  ACEITO = "ACEITO",
  EM_ANDAMENTO = "EM ANDAMENTO",
  CONCLUIDO = "CONCLUIDO",
  CANCELADO = "CANCELADO"
}

@Entity("hires")
export class Hire {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date"})
  firstContact: Date;

  @Column({ type: "double" })
  price: number;

  @Column({ length: 100, nullable: false })
  description_service: string;

  // Quando o pedido foi feito (usado para expirar pedidos sem resposta)
  @CreateDateColumn()
  createdAt: Date;

  // Aceite do prestador
  @Column({ type: "datetime", nullable: true })
  acceptedAt: Date | null;

  // Cancelamento: quem cancelou (cliente, prestador ou sistema = expirado) e por quê
  @Column({ type: "varchar", length: 20, nullable: true })
  cancelledBy: "cliente" | "prestador" | "sistema" | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  cancelReason: string | null;

  // Horário escolhido pelo cliente na agenda do serviço (quando o serviço exige agendamento)
  @Column({ type: "datetime", nullable: true })
  scheduledAt: Date | null;

  // Contrato
  @OneToMany(() => Contract, (contract) => contract.hire)
  contracts: Contract[];

  // Cliente
  @ManyToOne(() => User, (user) => user.hires)
  user: User;

  @Column({
    type: "enum",
    enum: StatusEnum,
    default: StatusEnum.PENDENTE,
  })
  status: StatusEnum;

  @Column({
    type: "enum",
    enum: StatusEnum,
    default: StatusEnum.PENDENTE,
  })
  status_provider: StatusEnum;

  @ManyToOne(() => ServiceProvider, (provider) => provider.hires)
  provider: ServiceProvider;

  @ManyToOne(() => Service, (service) => service.hires, { onDelete: "CASCADE" })
  @JoinColumn()
  service: Service;

  @OneToOne(() => Payment)
  payment: Payment;
}
