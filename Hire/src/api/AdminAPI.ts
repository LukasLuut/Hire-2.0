import { apiRequest } from "./ApiClient";

// Painel de administração: todas as rotas exigem papel de administrador
const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });
const post = <T,>(path: string, body: unknown, method = "POST") =>
  apiRequest<T>(path, { method, headers: auth(), body: JSON.stringify(body) });

export interface AdminOverview {
  users: number;
  blocked: number;
  providers: number;
  services: number;
  pausedServices: number;
  hires: Record<string, number>;
  lateCancels: number;
  openReports: number;
  pendingVerifications: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  blocked: boolean;
  blockedReason: string | null;
  emailVerified: boolean;
  provider: { id: number; name: string } | null;
}

export interface AdminService {
  id: number;
  title: string;
  price: number;
  active: boolean;
  category: string | null;
  provider: { id: number; name: string; userId?: number } | null;
}

export interface AdminHire {
  id: number;
  title: string;
  price: number;
  status: string;
  status_provider: string;
  client: { id: number; name: string } | null;
  provider: { id: number; name: string } | null;
  firstContact: string;
  scheduledAt: string | null;
  cancelledBy: string | null;
  lateCancel: boolean;
}

export interface AdminCategory {
  id: number;
  name: string;
  description?: string;
}

export interface AdminVerification {
  provider: { id: number; name: string; cnpj: string | null; user: { id: number; name: string; email: string; cpf_cnpj: string } | null };
  status: "none" | "pending" | "verified" | "rejected";
  note: string | null;
  verifiedAt: string | null;
  files: { kind: "id" | "cert" | "company"; url: string }[];
}

export const adminAPI = {
  verifications: (status = "") => apiRequest<AdminVerification[]>(`/admin/verifications${status ? `?status=${status}` : ""}`, { headers: auth() }),
  decideVerification: (providerId: number, approve: boolean, note = "", extra: { company?: boolean; credentials?: boolean } = {}) =>
    post(`/admin/verifications/${providerId}`, { approve, note, ...extra }),
  overview: () => apiRequest<AdminOverview>("/admin/overview", { headers: auth() }),
  users: (q = "") => apiRequest<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`, { headers: auth() }),
  setBlocked: (id: number, blocked: boolean, reason = "") => post(`/admin/users/${id}/block`, { blocked, reason }),
  setRole: (id: number, role: "user" | "admin") => post(`/admin/users/${id}/role`, { role }, "PUT"),
  services: (q = "") => apiRequest<AdminService[]>(`/admin/services?q=${encodeURIComponent(q)}`, { headers: auth() }),
  setServiceActive: (id: number, active: boolean, reason = "") => post(`/admin/services/${id}/active`, { active, reason }),
  hires: (status = "") => apiRequest<AdminHire[]>(`/admin/hires${status ? `?status=${encodeURIComponent(status)}` : ""}`, { headers: auth() }),
  categories: () => apiRequest<AdminCategory[]>("/categories"),
  createCategory: (name: string, description: string) => post<AdminCategory>("/categories", { name, description }),
  updateCategory: (id: number, name: string, description: string) => post<AdminCategory>(`/categories/${id}`, { name, description }, "PUT"),
  deleteCategory: (id: number) => apiRequest(`/categories/${id}`, { method: "DELETE", headers: auth() }),
};
