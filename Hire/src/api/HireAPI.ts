import { apiRequest } from "./ApiClient";
import type { HireEntity } from "../interfaces/Entities";

// Todas as rotas de contratação exigem login
const auth = (token = localStorage.getItem("token")) => ({ Authorization: "Bearer " + token });

const setStatus = (id: number, body: { status?: string; status_provider?: string }) =>
  apiRequest<HireEntity>(`/hires/${id}`, { method: "PUT", headers: auth(), body: JSON.stringify(body) });

export const hireAPI = {

  /** O cliente vem do token; o prestador é o dono do serviço. */
  create: async (data: { price: number, serviceId: number, description?: string }) => {
    const response = await apiRequest<HireEntity>("/hires", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        price: data.price,
        description_service: data.description?.trim() || "Serviço contratado pela plataforma",
        serviceId: data.serviceId
      }),
    });

    if(!response) return;
    return response.id;
  },

  getMine: async (token?: string): Promise<HireEntity[]> => {
    const response = await apiRequest<HireEntity[]>("/hires/me", { headers: auth(token) });
    return response ?? [];
  },

  deleteHire: (id: number) => apiRequest(`/hires/${id}`, { method: "DELETE", headers: auth() }),

  /** Cancela pelo lado de quem chama; o backend encerra os dois lados. */
  cancelHire: (id: number, as: "client" | "provider" = "client") =>
    setStatus(id, as === "client" ? { status: "CANCELADO" } : { status_provider: "CANCELADO" }),

  concludeHire: (id: number) => setStatus(id, { status: "CONCLUIDO" }),

  concludeHireProvider: (id: number) => setStatus(id, { status_provider: "CONCLUIDO" }),

  beginHireProvider: (id: number) => setStatus(id, { status_provider: "EM ANDAMENTO" }),

  getHireByProviderId: async (id: number): Promise<HireEntity[]> => {
    return (await apiRequest<HireEntity[]>(`/hires/provider/${id}`, { headers: auth() })) ?? [];
  }

};
