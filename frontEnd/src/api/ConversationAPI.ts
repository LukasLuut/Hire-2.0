import { apiRequest } from "./ApiClient";
import type { ConversationDetail, ConversationSummary, NegotiationTopic } from "../interfaces/Entities";

const auth = (token: string) => ({ Authorization: "Bearer " + token });

export type AcceptResult =
  | { formalized: false; waitingFor: "cliente" | "prestador"; negotiationId: number }
  | { formalized: true; negotiationId: number; hireId: number; contractId: number; code: string };

/** Resposta das ações de negociação: resumo da conversa + id da negociação afetada */
export type NegotiationResult = ConversationSummary & { negotiationId: number };

export type ConversationFilter = "" | "unread" | "negotiating";

// id alto o bastante para `after` não trazer mensagens: só o resumo da conversa
const NO_MESSAGES = 2147483647;

/** Caminho da negociação: com id, a específica; sem, a aberta em destaque (rotas da v1) */
const neg = (id: number, nid?: number | null) => (nid ? `/conversations/${id}/negotiations/${nid}` : `/conversations/${id}`);

export const conversationAPI = {
  /** Abre a conversa com o prestador (uma por par). Com serviceId, abre também a negociação do serviço. */
  open: async (data: { providerId?: number; serviceId?: number }, token: string) => {
    return await apiRequest<ConversationSummary>("/conversations", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify(data),
    });
  },

  list: async (token: string, opts: { limit?: number; offset?: number; q?: string; filter?: ConversationFilter } = {}): Promise<ConversationSummary[]> => {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));
    if (opts.q?.trim()) params.set("q", opts.q.trim());
    if (opts.filter) params.set("filter", opts.filter);
    const qs = params.toString();
    return (await apiRequest<ConversationSummary[]>(`/conversations${qs ? `?${qs}` : ""}`, { headers: auth(token) })) ?? [];
  },

  /** Uma linha por negociação (painel do prestador, página Negociações) */
  negotiations: async (token: string): Promise<ConversationSummary[]> => {
    return (await apiRequest<ConversationSummary[]>("/conversations/negotiations", { headers: auth(token) })) ?? [];
  },

  get: async (id: number, token: string, afterId?: number) => {
    return await apiRequest<ConversationDetail>(`/conversations/${id}${afterId ? `?after=${afterId}` : ""}`, { headers: auth(token) });
  },

  /** Só o resumo (não lidas, negociação em destaque), sem mensagens */
  summary: async (id: number, token: string): Promise<ConversationSummary> => {
    return await apiRequest<ConversationDetail>(`/conversations/${id}?after=${NO_MESSAGES}`, { headers: auth(token) });
  },

  markRead: async (id: number, token: string) => {
    return await apiRequest<{ ok: boolean }>(`/conversations/${id}/read`, { method: "POST", headers: auth(token) });
  },

  send: async (id: number, text: string, token: string, attachment?: File | null) => {
    const form = new FormData();
    form.append("text", text);
    if (attachment) form.append("attachment", attachment);
    return await apiRequest<{ id: number }>(`/conversations/${id}/messages`, { method: "POST", headers: auth(token), body: form });
  },

  /** Abre uma negociação na conversa: serviço listado, proposta sob medida (prestador) ou pedido (cliente) */
  createNegotiation: async (
    id: number,
    data:
      | { serviceId: number }
      | { custom: { title: string; description: string; price: string; duration?: string; start?: string; saveToCatalog?: boolean } }
      | { proposal: { description: string; budget: string; date?: string; notes?: string } },
    token: string
  ) => {
    return await apiRequest<NegotiationResult>(`/conversations/${id}/negotiations`, { method: "POST", headers: auth(token), body: JSON.stringify(data) });
  },

  updateTopics: async (id: number, topics: NegotiationTopic[], token: string, note?: string, negotiationId?: number | null) => {
    return await apiRequest<NegotiationResult>(`${neg(id, negotiationId)}/topics`, {
      method: "PUT",
      headers: auth(token),
      body: JSON.stringify({ topics, note }),
    });
  },

  /** Aceite final do acordo; quando as duas partes aceitam, gera contratação e contrato. */
  accept: async (id: number, token: string, negotiationId?: number | null) => {
    return await apiRequest<AcceptResult>(`${neg(id, negotiationId)}/accept`, { method: "POST", headers: auth(token) });
  },

  /** Pedido de orçamento do cliente (abre uma negociação nova na conversa do par). */
  request: async (data: { serviceId?: number; providerId?: number; description: string; budget: string; date?: string; notes?: string }, files: File[], token: string) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)));
    files.forEach((f) => form.append("attachments", f));
    return await apiRequest<NegotiationResult>("/conversations/request", { method: "POST", headers: auth(token), body: form });
  },

  /** Resposta do prestador ao pedido de orçamento. */
  respond: async (id: number, data: { title: string; description: string; price: string; deadline: string }, files: File[], token: string, negotiationId?: number | null) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    files.forEach((f) => form.append("attachments", f));
    return await apiRequest<NegotiationResult>(`${neg(id, negotiationId)}/respond`, { method: "POST", headers: auth(token), body: form });
  },

  reject: async (id: number, reason: string, token: string, negotiationId?: number | null) => {
    return await apiRequest<NegotiationResult>(`${neg(id, negotiationId)}/reject`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ reason }),
    });
  },

  /** Encerra a negociação sem acordo (a conversa continua); o motivo vai para a outra parte */
  close: async (id: number, token: string, reason = "", negotiationId?: number | null) => {
    return await apiRequest<NegotiationResult>(`${neg(id, negotiationId)}/close`, { method: "POST", headers: auth(token), body: JSON.stringify({ reason }) });
  },
};
