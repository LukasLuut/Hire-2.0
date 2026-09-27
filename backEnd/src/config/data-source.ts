import 'reflect-metadata';
import { Withdrawal } from '../models/Withdrawal';
import { DataSource } from 'typeorm';
import * as dotenv from "dotenv";

import { User } from '../models/User';
import { Address } from '../models/Address';
import { Category } from '../models/Category';
import { Service } from '../models/Service';
import { ServiceProvider } from '../models/ServiceProvider';
import { Hire } from '../models/Hire';
import { Contract } from '../models/Contract';
import { Payment } from '../models/Payment';
import { Subcategory } from '../models/Subcategory';
import { Availability } from '../models/Availability';
import { Link } from '../models/Link';
import { Review } from '../models/Review';
import { ReviewPhoto } from '../models/ReviewPhoto';
import { ServiceLike } from '../models/ServiceLike';
import { Conversation } from '../models/Conversation';
import { Negotiation } from '../models/Negotiation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { AuthToken } from '../models/AuthToken';
import { Report } from '../models/Report';
import { PortfolioItem } from '../models/PortfolioItem';
import { AnalyticsDaily } from '../models/AnalyticsDaily';
import { Invite } from '../models/Invite';
import { SupportTicket } from '../models/SupportTicket';
import { ProviderFavorite } from '../models/ProviderFavorite';
import { LiveSubscriber } from '../subscribers/LiveSubscriber';

dotenv.config();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

export const AppDataSource = new DataSource({
    type: 'mysql',

    host: DB_HOST,

    port: Number(DB_PORT || "3306"),

    username: DB_USER,

    password: DB_PASSWORD,

    database: DB_NAME,

    // Desenvolvimento: synchronize cria/ajusta tabelas a partir das entidades (padrão).
    // Produção: DB_SYNC=false desliga o synchronize e aplica as migrations de src/migrations ao subir
    // (npm run migration:generate -- src/migrations/Nome para gerar a partir das entidades).
    synchronize: process.env.DB_SYNC !== "false",
    migrations: [__dirname + "/../migrations/*.{ts,js}"],
    migrationsRun: process.env.DB_SYNC === "false",

    // logging mostra no terminal todos os comandos SQL; ligue só para depurar (DB_LOGGING=true no .env)
    logging: process.env.DB_LOGGING === "true",

    // Aqui registramos as entidades (as classes que representam tabelas).
    // O TypeORM precisa saber quais são para criar o mapeamento com o banco.
    entities: [User, Address, Category, Service, ServiceProvider, Hire, Contract, Payment, Subcategory, Availability, Link, Review, ReviewPhoto, ServiceLike, Conversation, Negotiation, Message, Notification, AuthToken, Report, PortfolioItem, AnalyticsDaily, Invite, SupportTicket, ProviderFavorite, Withdrawal],
    subscribers: [LiveSubscriber],
});
