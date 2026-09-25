import { apiRequest } from "./ApiClient";
import { uploadUrl } from "../utils/avatar";
import type { RatingStats, ServiceEntity } from "../interfaces/Entities";


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
  provider?:{
    id?: number,
    professionalName?: string,
    companyName?: string,
    profileImageUrl?: string | null,
    description?: string,
    rating?: RatingStats,
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
    active: true,
    duration: e.duration ?? "",
    rating: e.rating?.average ?? 0,
    ratingCount: e.rating?.count ?? 0,
    negotiable: !!e.negotiable,
    requiresScheduling: !!e.requiresScheduling,
    likesNumber: e.likesNumber ?? 0,
    imageUrl: uploadUrl(e.imageUrl),
    provider: e.provider
      ? {
          id: e.provider.id,
          professionalName: e.provider.professionalName,
          companyName: e.provider.companyName,
          profileImageUrl: e.provider.profileImageUrl,
          description: e.provider.description ?? undefined,
          rating: e.provider.rating ?? EMPTY_STATS,
        }
      : undefined,
  };
}

const auth = (token: string) => ({ Authorization: "Bearer " + token });

export const serviceAPI = {

  create: async (data: FormData) => {
    return await apiRequest("/services", {
      method: "POST",
      body: data,
    });
  },

  getServices: async (): Promise<ServiceData[]> => {
    const response = await apiRequest<ServiceEntity[]>("/services", { method: "GET" });
    return Array.isArray(response) ? response.map(toServiceData) : [];
  },

  getServiceById: async (id: number): Promise<ServiceData | null> => {
    const response = await apiRequest<ServiceEntity>(`/services/${id}`, { method: "GET" });
    return response ? toServiceData(response) : null;
  },

  /** Remove um serviço (nome mantido do projeto original). */
  deleteUser: async (id: number) => {
    return await apiRequest(`/services/${id}`, { method: "DELETE" });
  },

  update: async (
    id: number,
    data: FormData
  ) => {
    return await apiRequest(`/services/${id}`, {
      method: "PUT",
      body: data
    });
  },

  toggleLike: async (id: number, token: string) => {
    return await apiRequest<{ liked: boolean; likesNumber: number }>(`/services/${id}/like`, { method: "POST", headers: auth(token) });
  },

  likedIds: async (token: string): Promise<number[]> => {
    return (await apiRequest<number[]>("/services/liked", { headers: auth(token) })) ?? [];
  },
};
