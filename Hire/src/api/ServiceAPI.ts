import { apiRequest } from "./ApiClient";
import { uploadUrl } from "../utils/avatar";
import type { RatingStats, ScheduleSlots, ServiceEntity } from "../interfaces/Entities";


export interface ServiceData {
  id: number,
  title: string,
  description_service: string,
  category: {id: number, name: string, description?: string},
  subcategory: string,
  price: number,
  active: boolean,
  duration: string,
  /** Nota média real do serviço (0 quando ainda não há avaliações) */
  rating: number,
  ratingCount: number,
  negotiable: boolean,
  requiresScheduling: boolean,
  likesNumber: number,
  /** URL absoluta da imagem (ou null) */
  imageUrl: string | null,
  /** URLs absolutas de todas as imagens (capa primeiro) */
  images: string[],
  /** Caminhos como estão no servidor (/uploads/...), usados ao reordenar na edição */
  imagePaths: string[],
  scheduleSlots: ScheduleSlots | null,
  cancellationNotice: string | null,
  /** com a localização do cliente: distância até o prestador e se ele atende a região */
  distanceKm?: number | null,
  servesYou?: boolean,
  provider?:{
    id?: number,
    professionalName?: string,
    companyName?: string,
    profileImageUrl?: string | null,
    description?: string,
    rating?: RatingStats,
    baseCity?: string | null,
    baseState?: string | null,
    attendsOnline?: boolean,
    serviceRadiusKm?: number,
  },
}

const EMPTY_STATS: RatingStats = { average: 0, count: 0 };

/** Converte o serviço da API para o formato usado pelas telas. */
export function toServiceData(e: ServiceEntity): ServiceData {
  return {
    id: e.id,
    title: e.title,
    description_service: e.description_service ?? "",
    category: e.category ? { id: e.category.id, name: e.category.name, description: e.category.description } : { id: 0, name: "Sem categoria" },
    subcategory: e.subcategory && e.subcategory !== "Has no subcategory" ? e.subcategory : "",
    price: Number(e.price),
    active: e.active !== false,
    duration: e.duration ?? "",
    rating: e.rating?.average ?? 0,
    ratingCount: e.rating?.count ?? 0,
    negotiable: !!e.negotiable,
    requiresScheduling: !!e.requiresScheduling,
    likesNumber: e.likesNumber ?? 0,
    imageUrl: uploadUrl(e.imageUrl),
    imagePaths: e.images?.length ? e.images : e.imageUrl ? [e.imageUrl] : [],
    images: (e.images?.length ? e.images : e.imageUrl ? [e.imageUrl] : []).map((p) => uploadUrl(p)!).filter(Boolean),
    scheduleSlots: e.scheduleSlots ?? null,
    cancellationNotice: e.cancellationNotice ?? null,
    distanceKm: (e as ServiceEntity & { distanceKm?: number | null }).distanceKm,
    servesYou: (e as ServiceEntity & { servesYou?: boolean }).servesYou,
    provider: e.provider
      ? {
          id: e.provider.id,
          professionalName: e.provider.professionalName,
          companyName: e.provider.companyName,
          profileImageUrl: e.provider.profileImageUrl,
          description: e.provider.description ?? undefined,
          rating: e.provider.rating ?? EMPTY_STATS,
          baseCity: e.provider.baseCity,
          baseState: e.provider.baseState,
          attendsOnline: e.provider.attendsOnline,
          serviceRadiusKm: e.provider.serviceRadiusKm,
        }
      : undefined,
  };
}

const auth = (token = localStorage.getItem("token") ?? "") => ({ Authorization: "Bearer " + token });

export const serviceAPI = {

  create: async (data: FormData) => {
    return await apiRequest("/services", {
      method: "POST",
      headers: auth(),
      body: data,
    });
  },

  /** Vitrine; com a localização, traz distância e pode filtrar só quem atende a região. */
  getServices: async (near?: { lat: number; lng: number; onlyNearby?: boolean } | null): Promise<ServiceData[]> => {
    const qs = near ? `?lat=${near.lat}&lng=${near.lng}${near.onlyNearby ? "&onlyNearby=true" : ""}` : "";
    const response = await apiRequest<ServiceEntity[]>(`/services${qs}`, { method: "GET" });
    return Array.isArray(response) ? response.map(toServiceData) : [];
  },

  getServiceById: async (id: number): Promise<ServiceData | null> => {
    const response = await apiRequest<ServiceEntity>(`/services/${id}`, { method: "GET" });
    return response ? toServiceData(response) : null;
  },

  /** Remove um serviço (nome mantido do projeto original). */
  deleteUser: async (id: number) => {
    return await apiRequest(`/services/${id}`, { method: "DELETE", headers: auth() });
  },

  update: async (
    id: number,
    data: FormData
  ) => {
    return await apiRequest(`/services/${id}`, {
      method: "PUT",
      headers: auth(),
      body: data
    });
  },

  /** Pausa ou reativa um serviço (só o dono). */
  setActive: async (id: number, active: boolean) => {
    const form = new FormData();
    form.append("active", active ? "true" : "false");
    return await apiRequest(`/services/${id}`, { method: "PUT", headers: auth(), body: form });
  },

  toggleLike: async (id: number, token: string) => {
    return await apiRequest<{ liked: boolean; likesNumber: number }>(`/services/${id}/like`, { method: "POST", headers: auth(token) });
  },

  /** Serviços curtidos pelo usuário (favoritos). */
  favorites: async (token: string): Promise<ServiceData[]> => {
    const list = await apiRequest<ServiceEntity[]>("/services/favorites", { headers: auth(token) });
    return Array.isArray(list) ? list.map(toServiceData) : [];
  },

  likedIds: async (token: string): Promise<number[]> => {
    return (await apiRequest<number[]>("/services/liked", { headers: auth(token) })) ?? [];
  },
};

/** Imagens do serviço para exibir; sem fotos, uma arte do DiceBear baseada no título. */
export function serviceImages(s: ServiceData): string[] {
  return s.images.length ? s.images : [`https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(s.title)}`];
}
