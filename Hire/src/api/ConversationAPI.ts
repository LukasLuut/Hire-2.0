import { apiRequest } from "./ApiClient";
import type { ConversationDetail, ConversationSummary, NegotiationTopic } from "../interfaces/Entities";

const auth = (token: string) => ({ Authorization: "Bearer " + token });

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

  formalize: async (id: number, token: string) => {
    return await apiRequest<{ hireId: number; contractId: number; code: string }>(`/conversations/${id}/formalize`, {
      method: "POST",
      headers: auth(token),
    });
  },

  close: async (id: number, token: string) => {
    return await apiRequest<ConversationSummary>(`/conversations/${id}/close`, { method: "POST", headers: auth(token) });
  },
};
