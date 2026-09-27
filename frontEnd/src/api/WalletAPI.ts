import { apiRequest } from "./ApiClient";

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
export type WithdrawalStatus = "SOLICITADO" | "EM_PROCESSAMENTO" | "PAGO" | "RECUSADO" | "CANCELADO";

export interface Withdrawal {
  id: number;
  amount: number;
  pixKeyType: PixKeyType;
  pixKey: string;
  status: WithdrawalStatus;
  note: string | null;
  transactionCode: string | null;
  requestedAt: string;
  processedAt: string | null;
  paidAt: string | null;
  provider?: { id: number; name: string };
}

export interface StatementEntry {
  id: string;
  date: string;
  kind: "entrada" | "a_receber" | "estorno" | "saque";
  title: string;
  detail: string;
  amount: number;
  status: string;
  hireId?: number | null;
}

export interface Wallet {
  available: number;
  pending: number;
  released: number;
  withdrawn: number;
  inTransit: number;
  fees: number;
  gross: number;
  minWithdrawal: number;
  lastPixKey: { type: PixKeyType; key: string } | null;
  statement: StatementEntry[];
  withdrawals: Withdrawal[];
}

export const PIX_LABEL: Record<PixKeyType, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Chave aleatória" };
export const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  SOLICITADO: "Solicitado",
  EM_PROCESSAMENTO: "Em processamento",
  PAGO: "Pago",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
};

export const walletAPI = {
  get: async () => (await apiRequest<Wallet>("/wallet", { headers: auth() }))!,
  withdraw: (data: { amount: number; pixKeyType: PixKeyType; pixKey: string }) =>
    apiRequest<Withdrawal>("/wallet/withdrawals", { method: "POST", headers: auth(), body: JSON.stringify(data) }),
  cancel: (id: number) => apiRequest<Withdrawal>(`/wallet/withdrawals/${id}/cancel`, { method: "POST", headers: auth() }),
  adminList: async (status?: string) => (await apiRequest<Withdrawal[]>(`/admin/withdrawals${status ? `?status=${status}` : ""}`, { headers: auth() })) ?? [],
  adminAdvance: (id: number, action: "process" | "pay" | "refuse", note?: string) =>
    apiRequest<Withdrawal>(`/admin/withdrawals/${id}`, { method: "POST", headers: auth(), body: JSON.stringify({ action, note }) }),
};
