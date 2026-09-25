import { apiRequest } from "./ApiClient";
import type { ConversationDetail, ConversationSummary, NegotiationTopic } from "../interfaces/Entities";

const auth = (token: string) => ({ Authorization: "Bearer " + token });

export type AcceptResult =
  | { formalized: false; waitingFor: "cliente" | "prestador" }
  | { formalized: true; hireId: number; contractId: number; code: string };

export const conversationAPI = {
  /** Abre (ou reaproveita) a negociação com um prestador, opcionalmente sobre um serviço. */
  open: async (data: { providerId?: number; serviceId?: number }, token: string) => {
    return await apiRequest<ConversationSummary>("/conversations", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify(data),
    });
  },

  list: async (token: string): Promise<ConversationSummary[]> => {
    return (await apiRequest<ConversationSummary[]>("/conversations", { headers: auth(token) })) ?? [];
  },

  get: async (id: number, token: string, afterId?: number) => {
    return await apiRequest<ConversationDetail>(`/conversations/${id}${afterId ? `?after=${afterId}` : ""}`, { headers: auth(token) });
  },

  send: async (id: number, text: string, token: string, attachment?: File | null) => {
    const form = new FormData();
    form.append("text", text);
    if (attachment) form.append("attachment", attachment);
    return await apiRequest<{ id: number }>(`/conversations/${id}/messages`, { method: "POST", headers: auth(token), body: form });
  },

  updateTopics: async (id: number, topics: NegotiationTopic[], token: string, note?: string) => {
    return await apiRequest<ConversationSummary>(`/conversations/${id}/topics`, {
      method: "PUT",
      headers: auth(token),
      body: JSON.stringify({ topics, note }),
    });
  },

  /** Aceite final do acordo; quando as duas partes aceitam, gera contratação e contrato. */
  accept: async (id: number, token: string) => {
    return await apiRequest<AcceptResult>(`/conversations/${id}/accept`, { method: "POST", headers: auth(token) });
  },

  /** Pedido de orçamento do cliente (abre a negociação com a proposta dele). */
  request: async (data: { serviceId: number; description: string; budget: string; date?: string; notes?: string }, files: File[], token: string) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)));
    files.forEach((f) => form.append("attachments", f));
    return await apiRequest<ConversationSummary>("/conversations/request", { method: "POST", headers: auth(token), body: form });
  },

  /** Resposta do prestador ao pedido de orçamento. */
  respond: async (id: number, data: { title: string; description: string; price: string; deadline: string }, files: File[], token: string) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    files.forEach((f) => form.append("attachments", f));
    return await apiRequest<ConversationSummary>(`/conversations/${id}/respond`, { method: "POST", headers: auth(token), body: form });
  },

  reject: async (id: number, reason: string, token: string) => {
    return await apiRequest<ConversationSummary>(`/conversations/${id}/reject`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ reason }),
    });
  },

  close: async (id: number, token: string) => {
    return await apiRequest<ConversationSummary>(`/conversations/${id}/close`, { method: "POST", headers: auth(token) });
  },
};
