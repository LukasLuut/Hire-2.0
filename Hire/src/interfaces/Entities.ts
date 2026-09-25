/* Formatos das entidades como a API devolve (campos usados pelo frontend). */

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
  description?: string | null;
  cnpj?: string | null;
  profileImageUrl?: string | null;
  status?: string;
  onlineLink?: string | null;
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
  imageUrl?: string | null;
  category?: CategoryEntity | null;
  provider?: ProviderEntity | null;
  rating?: RatingStats;
}

export interface HireEntity {
  id: number;
  price: number;
  description_service: string;
  firstContact: string;
  status: string;
  status_provider: string;
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
}

export interface ConversationSummary {
  id: number;
  status: "OPEN" | "FORMALIZED" | "CLOSED";
  topics: NegotiationTopic[];
  myRole: "cliente" | "prestador" | null;
  client: { id: number; name: string } | null;
  provider: { id: number; companyName: string; professionalName: string; profileImageUrl?: string | null; userId?: number } | null;
  service: { id: number; title: string; price: number; duration: string; description: string } | null;
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
