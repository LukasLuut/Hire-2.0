import { apiRequest } from "./ApiClient";
import type { PortfolioItem, ProviderEntity, ServiceEntity } from "../interfaces/Entities";

export interface Verification {
  status: "none" | "pending" | "verified" | "rejected";
  note: string | null;
  verifiedAt: string | null;
  files: { kind: "id" | "cert"; url: string }[];
}

const auth = (token: string) => ({ Authorization: "Bearer " + token });

export const providerApi = {

  create: async (data: FormData, token: string) => {
    return await apiRequest("/providers", {
      method: "POST",
      headers: auth(token),
      body: data,
    });
  },

  update: async (data: FormData, token: string) => {
    return await apiRequest<ProviderEntity>("/providers", {
      method: "PUT",
      headers: auth(token),
      body: data,
    });
  },

  /** Situação da verificação de documentos do próprio prestador */
  verification: (token: string) =>
    apiRequest<Verification>("/providers/me/verification", { headers: auth(token) }),

  /** Envia documento de identidade (obrigatório) e certificados para análise */
  submitVerification: (idDocument: File, certifications: File[], token: string) => {
    const body = new FormData();
    body.append("idDocument", idDocument);
    for (const f of certifications.slice(0, 4)) body.append("certifications", f);
    return apiRequest<Verification>("/providers/me/verification", { method: "POST", headers: auth(token), body });
  },

  /** Perfil de prestador do usuário logado (erro 404 quando ainda não é prestador). */
  getByUser: async (token: string): Promise<ProviderEntity | null> => {
    const response = await apiRequest<ProviderEntity>("/providers", { method: "GET", headers: auth(token) });
    return response ?? null;
  },

  getServices: async (token: string): Promise<ServiceEntity[]> => {
    const response = await apiRequest<ServiceEntity[]>("/providers/services", { method: "GET", headers: auth(token) });
    return response ?? [];
  },

  /** Todos os prestadores, ordenados pela nota (Top Prestadores). */
  getAll: async (): Promise<ProviderEntity[]> => {
    return (await apiRequest<ProviderEntity[]>("/providers/all")) ?? [];
  },

  /** Perfil público de um prestador (Ver perfil). */
  /* ---- portfólio do próprio prestador ---- */
  portfolio: (token: string) => apiRequest<PortfolioItem[]>("/providers/me/portfolio", { headers: auth(token) }),
  addPortfolio: (body: FormData, token: string) =>
    apiRequest<PortfolioItem>("/providers/me/portfolio", { method: "POST", headers: auth(token), body }),
  updatePortfolio: (id: number, body: FormData, token: string) =>
    apiRequest<PortfolioItem>(`/providers/me/portfolio/${id}`, { method: "PUT", headers: auth(token), body }),
  removePortfolio: (id: number, token: string) =>
    apiRequest(`/providers/me/portfolio/${id}`, { method: "DELETE", headers: auth(token) }),
  reorderPortfolio: (ids: number[], token: string) =>
    apiRequest<PortfolioItem[]>("/providers/me/portfolio/order", { method: "PUT", headers: auth(token), body: JSON.stringify({ ids }) }),

  /** Perfil público por id numérico ou slug */
  getPublic: async (id: number | string) => {
    return await apiRequest<ProviderEntity & { services: ServiceEntity[] }>(`/providers/${id}/public`);
  },
};
