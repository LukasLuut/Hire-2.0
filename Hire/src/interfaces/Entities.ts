/* Formatos das entidades como a API devolve (campos usados pelo frontend). */
import type { PriceUnit, ServicePackage } from "../utils/price";

export interface RatingStats {
  average: number;
  count: number;
}

export interface CategoryEntity {
  id: number;
  name: string;
  description?: string;
}

export interface AvailabilityEntity {
  id?: number;
  day: string;
  start: string;
  end: string;
}

export interface ProviderEntity {
  id: number;
  professionalName: string;
  companyName: string;
  professionalEmail: string;
  professionalPhone: string;
  /** contato visível no perfil público (a API pública só manda e-mail/telefone quando true) */
  showContact?: boolean;
  slug?: string | null;
  createdAt?: string | null;
  /** (perfil público) trabalhos do portfólio, em ordem */
  portfolio?: PortfolioItem[];
  /** (perfil público) data de entrada no Hire */
  memberSince?: string | null;
  /** (perfil público) e-mail da conta confirmado */
  emailVerified?: boolean;
  description?: string | null;
  cnpj?: string | null;
  profileImageUrl?: string | null;
  status?: string;
  onlineLink?: string | null;
  /** área de atendimento presencial */
  baseCity?: string | null;
  baseState?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceRadiusKm?: number;
  attendsPresent: boolean;
  attendsOnline: boolean;
  personalizedProposals: boolean;
  approximateLocation: boolean;
  publicReviews: boolean;
  pricesOnPage: boolean;
  whatsNotification: boolean;
  emailNotification: boolean;
  category?: CategoryEntity | null;
  subcategories?: { id: number; name: string }[];
  links?: { id: number; name: string }[];
  availabilities?: AvailabilityEntity[];
  user?: { id: number; name: string };
  rating?: RatingStats;
  completedHires?: number;
  level?: string;
  /** cancelamentos em cima da hora nos últimos 12 meses */
  lateCancellations?: number;
  /** verificação de documentos pela administração */
  verificationStatus?: "none" | "pending" | "verified" | "rejected";
  /** (perfil público) comprovante do CNPJ conferido */
  companyVerified?: boolean;
  /** (perfil público) certificados profissionais conferidos */
  credentialsVerified?: boolean;
  /** (painel do dono) datas das verificações extras */
  companyVerifiedAt?: string | null;
  credentialsVerifiedAt?: string | null;
  verifiedAt?: string | null;
}

export interface ServiceEntity {
  id: number;
  title: string;
  description_service: string;
  price: number | string;
  duration: string;
  subcategory?: string;
  negotiable: boolean;
  requiresScheduling: boolean;
  likesNumber?: number;
  /** false = pausado pelo prestador (fora da vitrine, sem pedidos novos) */
  active?: boolean;
  priceUnit?: PriceUnit;
  packages?: ServicePackage[] | null;
  imageUrl?: string | null;
  /** Todas as imagens na ordem do prestador (a primeira é a capa) */
  images?: string[] | null;
  /** Horários de início por dia da semana: { monday: ["08:00", ...] } */
  scheduleSlots?: ScheduleSlots | null;
  cancellationNotice?: string | null;
  category?: CategoryEntity | null;
  provider?: ProviderEntity | null;
  rating?: RatingStats;
}

export type ScheduleSlots = Partial<Record<"sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday", string[]>>;

export interface HireEntity {
  id: number;
  price: number;
  description_service: string;
  firstContact: string;
  status: string;
  status_provider: string;
  /** Horário reservado na agenda do serviço ("AAAA-MM-DD HH:mm:ss" ou ISO) */
  scheduledAt?: string | null;
  createdAt?: string;
  acceptedAt?: string | null;
  /** quem cancelou: cliente, prestador ou sistema (pedido expirado) */
  cancelledBy?: "cliente" | "prestador" | "sistema" | null;
  cancelReason?: string | null;
  /** problema relatado em análise pela administração (avaliações bloqueadas) */
  disputed?: boolean;
  /** cancelado depois do prazo de cancelamento do serviço */
  lateCancel?: boolean;
  /** pedido de novo horário aguardando a outra parte */
  rescheduleTo?: string | null;
  rescheduleBy?: "cliente" | "prestador" | null;
  /** (lista do prestador) cancelamentos em cima da hora deste cliente */
  clientLateCancellations?: number;
  /** pacote escolhido e quantidade (horas/m²) */
  packageName?: string | null;
  quantity?: number | null;
  user?: { id: number; name: string };
  provider?: ProviderEntity;
  service?: ServiceEntity;
}

export interface ReviewEntity {
  id: number;
  rating: number;
  comment: string | null;
  direction: "CLIENT_TO_PROVIDER" | "PROVIDER_TO_CLIENT";
  createdAt: string;
  hireId?: number;
  service: { id: number; title: string } | null;
  author: { id: number; name: string } | null;
  photos: { id: number; url: string }[];
}

export interface ReviewList extends RatingStats {
  reviews: ReviewEntity[];
}

export interface NegotiationTopic {
  key: string;
  label: string;
  tooltip?: string;
  state: "Acordado" | "Pendente" | "Negado";
  content: string;
  /** Quem propôs o conteúdo atual; só a outra parte pode aceitá-lo */
  proposedBy?: "cliente" | "prestador" | null;
}

export interface QuoteRequest {
  description: string;
  budget: string;
  date: string;
  notes: string;
}

export interface ConversationSummary {
  id: number;
  status: "OPEN" | "FORMALIZED" | "CLOSED";
  topics: NegotiationTopic[];
  myRole: "cliente" | "prestador" | null;
  client: { id: number; name: string } | null;
  provider: { id: number; companyName: string; professionalName: string; profileImageUrl?: string | null; userId?: number } | null;
  service: { id: number; title: string; price: number; duration: string; description: string } | null;
  request: QuoteRequest | null;
  requestStatus: "PENDENTE" | "RESPONDIDA" | "RECUSADA" | null;
  rejectReason: string | null;
  clientAcceptedAt: string | null;
  providerAcceptedAt: string | null;
  hireId: number | null;
  contractId: number | null;
  updatedAt: string;
  lastMessage: { text: string; role: string; createdAt: string } | null;
}

export interface ChatMessage {
  id: number;
  role: "cliente" | "prestador" | "system";
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
  sender: { id: number; name: string } | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

/** Trabalho do portfólio do prestador */
export interface PortfolioItem {
  id: number;
  imageUrl: string;
  title: string;
  description: string;
  position: number;
  service: { id: number; title: string } | null;
}
