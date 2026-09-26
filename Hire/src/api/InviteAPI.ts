import { apiRequest } from "./ApiClient";

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

export type InviteKind = "provider" | "client";
export interface InviteLink { code: string; url: string; kind: InviteKind; context: string }
export interface MyInvite extends InviteLink { id: number; inviterRole: string; createdAt: string; signups: number; converted: number }
export interface InviteInfo { kind: InviteKind; context: string; inviterFirstName: string }

/** Código do convite guardado entre a página do convite e o cadastro */
export const PENDING_INVITE_KEY = "hire.invite";

export const inviteAPI = {
  create: (kind: InviteKind, context = "") =>
    apiRequest<InviteLink>("/invites", { method: "POST", headers: auth(), body: JSON.stringify({ kind, context }) }),
  mine: () => apiRequest<MyInvite[]>("/invites/me", { headers: auth() }),
  info: (code: string) => apiRequest<InviteInfo>(`/invites/${encodeURIComponent(code)}`),
};

export function pendingInvite() {
  try {
    const raw = localStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const { code, exp } = JSON.parse(raw);
    if (Date.now() > exp) {
      localStorage.removeItem(PENDING_INVITE_KEY);
      return null;
    }
    return String(code);
  } catch {
    return null;
  }
}

/** Guarda o convite por 30 dias (a pessoa pode se cadastrar depois) */
export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code, exp: Date.now() + 30 * 86400000 }));
  } catch { /* armazenamento bloqueado: o convite só não é atribuído */ }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* nada */ }
}
