import { apiRequest } from "./ApiClient";
import type { Agenda } from "../components/Schedule";
import type { HireEntity, PaymentMethod, ServiceAddress } from "../interfaces/Entities";

// Todas as rotas de contratação exigem login
const auth = (token = localStorage.getItem("token")) => ({ Authorization: "Bearer " + token });

const setStatus = (id: number, body: { status?: string; status_provider?: string; reason?: string }) =>
  apiRequest<HireEntity>(`/hires/${id}`, { method: "PUT", headers: auth(), body: JSON.stringify(body) });

export const hireAPI = {

  /** O cliente vem do token; o prestador é o dono do serviço. */
  create: async (data: { price: number, serviceId: number, description?: string, scheduledAt?: string, packageIndex?: number, quantity?: number }) => {
    const response = await apiRequest<HireEntity>("/hires", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        price: data.price,
        description_service: data.description?.trim() || "Serviço contratado pela plataforma",
        serviceId: data.serviceId,
        scheduledAt: data.scheduledAt,
        packageIndex: data.packageIndex,
        quantity: data.quantity,
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
  cancelHire: (id: number, as: "client" | "provider" = "client", reason = "") =>
    setStatus(id, as === "client" ? { status: "CANCELADO", reason } : { status_provider: "CANCELADO", reason }),

  /** Prestador aceita o pedido (depois disso pode iniciar). */
  acceptHire: (id: number) => setStatus(id, { status_provider: "ACEITO" }),

  concludeHire: (id: number) => setStatus(id, { status: "CONCLUIDO" }),

  concludeHireProvider: (id: number) => setStatus(id, { status_provider: "CONCLUIDO" }),

  beginHireProvider: (id: number) => setStatus(id, { status_provider: "EM ANDAMENTO" }),

  /** Agenda do serviço: períodos ocupados do prestador, expediente e duração (para montar os horários livres). */
  bookedSlots: async (serviceId: number, excludeHireId?: number): Promise<Agenda> => {
    const q = excludeHireId ? `?exclude=${excludeHireId}` : "";
    return (await apiRequest<Agenda>(`/hires/booked/${serviceId}${q}`, { headers: auth() })) ?? { busy: [], hours: {}, durationMinutes: 60 };
  },

  /** Cliente informa/troca o endereço do atendimento antes de começar */
  setAddress: (id: number, address: ServiceAddress) =>
    apiRequest<HireEntity>(`/hires/${id}/address`, { method: "PUT", headers: auth(), body: JSON.stringify(address) }),

  /** Pagamento simulado do cliente depois do aceite */
  pay: (id: number, method: PaymentMethod) =>
    apiRequest<HireEntity>(`/hires/${id}/pay`, { method: "POST", headers: auth(), body: JSON.stringify({ method }) }),

  /** Pedido negociado: o cliente marca o horário na agenda do serviço. */
  schedule: (id: number, scheduledAt: string) =>
    apiRequest<HireEntity>(`/hires/${id}/schedule`, { method: "POST", headers: auth(), body: JSON.stringify({ scheduledAt }) }),

  /** Pede um novo horário; a outra parte aceita ou recusa. */
  reschedule: (id: number, scheduledAt: string) =>
    apiRequest<HireEntity>(`/hires/${id}/reschedule`, { method: "POST", headers: auth(), body: JSON.stringify({ scheduledAt }) }),

  /** Aceita/recusa o novo horário (quem pediu usa accept = false para desistir). */
  answerReschedule: (id: number, accept: boolean) =>
    apiRequest<HireEntity>(`/hires/${id}/reschedule/answer`, { method: "POST", headers: auth(), body: JSON.stringify({ accept }) }),

  getHireByProviderId: async (id: number): Promise<HireEntity[]> => {
    return (await apiRequest<HireEntity[]>(`/hires/provider/${id}`, { headers: auth() })) ?? [];
  }

};
