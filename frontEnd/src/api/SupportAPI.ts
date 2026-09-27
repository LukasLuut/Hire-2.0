import { apiRequest } from "./ApiClient";

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

export type SupportCategory = "conta" | "pagamento" | "pedido" | "tecnico" | "sugestao" | "outro";
export type SupportStatus = "ABERTO" | "EM_ATENDIMENTO" | "RESOLVIDO";

export interface SupportTicket {
  id: number;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  reply: string | null;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** só na visão da administração */
  user?: { id: number; name: string; email: string } | null;
}

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  conta: "Minha conta",
  pagamento: "Pagamentos",
  pedido: "Pedidos e contratações",
  tecnico: "Problema técnico",
  sugestao: "Sugestão",
  outro: "Outro assunto",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em atendimento",
  RESOLVIDO: "Resolvido",
};

export const supportAPI = {
  create: (data: { category: SupportCategory; subject: string; message: string }) =>
    apiRequest<SupportTicket>("/support", { method: "POST", headers: auth(), body: JSON.stringify(data) }),
  mine: async () => (await apiRequest<SupportTicket[]>("/support/me", { headers: auth() })) ?? [],
  adminList: async (status?: string) => (await apiRequest<SupportTicket[]>(`/admin/support${status ? `?status=${status}` : ""}`, { headers: auth() })) ?? [],
  answer: (id: number, status: SupportStatus, reply: string) =>
    apiRequest<SupportTicket>(`/admin/support/${id}`, { method: "POST", headers: auth(), body: JSON.stringify({ status, reply }) }),
};
