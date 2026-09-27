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
  subcategories?: string[] | null;
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
  /** (perfil público) página da categoria na cidade, quando existe */
  cityPage?: { path: string; label: string } | null;
  /** (perfil público) trabalhos do portfólio, em ordem */
  portfolio?: PortfolioItem[];
  /** fechado até esta data (com status "paused"); sem data = fechado até reabrir */
  closedUntil?: string | null;
  /** conta profissional desativada pelo dono (só aparece para o próprio dono) */
  deactivatedAt?: string | null;
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
  /** selo "Conta verificada": cadastro completo + todas as validações (calculado no servidor) */
  verified?: boolean;
  /** (perfil público) comprovante do CNPJ conferido */
  companyVerified?: boolean;
  /** autônomo ou empresa (MEI/ME/EPP) */
  businessType?: "autonomo" | "empresa";
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
  /** atendimento online (sem endereço do cliente) */
  online?: boolean;
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

export type PaymentMethod = "pix" | "cartao" | "boleto";

/** Endereço do atendimento presencial (antes do aceite o prestador vê só bairro e cidade) */
export interface ServiceAddress {
  postalCode: string;
  street: string;
  num: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

/** Pagamento simulado de uma contratação (PAGO = retido até a conclusão) */
export interface PaymentEntity {
  id: number;
  amount: number;
  feePercent: number;
  fee: number;
  net: number;
  method: PaymentMethod;
  status: "PAGO" | "LIBERADO" | "ESTORNADO";
  transactionCode: string;
  /** cartão: bandeira, final e parcelas; boleto: linha digitável */
  details?: { brand?: string; last4?: string; installments?: number; barcode?: string } | null;
  paidAt: string;
  releasedAt?: string | null;
  refundedAt?: string | null;
}

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
  /** pedido criado com a etapa de pagamento (antigos não têm) */
  paymentRequired?: boolean;
  payment?: PaymentEntity | null;
  serviceAddress?: ServiceAddress | null;
  /** horários reais: início, entrega e confirmação do cliente */
  startedAt?: string | null;
  finishedAt?: string | null;
  confirmedAt?: string | null;
}

export interface ReviewEntity {
  id: number;
  rating: number;
  comment: string | null;
  /** comentário ocultado pela moderação (a nota continua) */
  moderated?: boolean;
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

export type Party = "cliente" | "prestador";
export type NegotiationStatus = "OPEN" | "FORMALIZED" | "CLOSED";
/** servico: serviço listado · pedido: o cliente descreveu o que precisa · sob_medida: proposta montada pelo prestador */
export type NegotiationOrigin = "servico" | "pedido" | "sob_medida";

/** Uma negociação dentro da conversa do par */
export interface Negotiation {
  id: number;
  status: NegotiationStatus;
  origin: NegotiationOrigin;
  createdBy: Party;
  title: string;
  topics: NegotiationTopic[];
  service: { id: number; title: string; price: number; duration: string; description: string } | null;
  request: QuoteRequest | null;
  requestStatus: "PENDENTE" | "RESPONDIDA" | "RECUSADA" | null;
  rejectReason: string | null;
  closedBy: Party | null;
  closeReason: string | null;
  clientAcceptedAt: string | null;
  providerAcceptedAt: string | null;
  hireId: number | null;
  contractId: number | null;
  contractCode: string | null;
  /** de quem a negociação aberta espera o próximo passo */
  waitingFor: Party | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversa do par cliente ↔ prestador (uma só, nunca fecha).
 * Os campos status/topics/service/... repetem a negociação em destaque (formato da v1).
 */
export interface ConversationSummary {
  id: number;
  myRole: Party | null;
  client: { id: number; name: string; avatarUrl?: string | null } | null;
  provider: { id: number; companyName: string; professionalName: string; profileImageUrl?: string | null; slug?: string | null; userId?: number } | null;
  lastMessage: { text: string; role: string; event?: string | null; createdAt: string } | null;
  lastMessageAt: string | null;
  /** mensagens não lidas por quem pediu (contadas no servidor) */
  unread: number;
  openNegotiations: number;
  /** há negociação aberta esperando a resposta de quem pediu */
  waitingForMe: boolean;
  negotiation: Negotiation | null;
  negotiationId: number | null;
  status: NegotiationStatus;
  topics: NegotiationTopic[];
  service: Negotiation["service"];
  request: QuoteRequest | null;
  requestStatus: Negotiation["requestStatus"];
  rejectReason: string | null;
  closedBy?: Party | null;
  closeReason?: string | null;
  clientAcceptedAt: string | null;
  providerAcceptedAt: string | null;
  hireId: number | null;
  contractId: number | null;
  updatedAt: string;
}

export type ChatEvent =
  | "negotiation.opened"
  | "negotiation.proposal"
  | "negotiation.topic"
  | "negotiation.accepted"
  | "negotiation.formalized"
  | "negotiation.rejected"
  | "negotiation.closed";

export interface ChatMessage {
  id: number;
  role: "cliente" | "prestador" | "system";
  text: string;
  /** marco da negociação (vira card na conversa) */
  event?: ChatEvent | null;
  negotiationId?: number | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
  sender: { id: number; name: string } | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
  /** todas as negociações da conversa, mais recentes primeiro */
  negotiations: Negotiation[];
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
