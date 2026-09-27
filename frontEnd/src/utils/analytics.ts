import { LOCAL_PORT } from "../api/ApiClient";

/* --------------------------------------------------------------------------
 * Métricas de aquisição — único ponto de envio de eventos do frontend.
 * Sem cookies, sem id de usuário, sem scripts de terceiros: o servidor só soma
 * contadores por dia/evento/prestador/serviço/origem (ver backend AnalyticsService).
 * Visualizações contam uma vez por sessão da aba.
 * -------------------------------------------------------------------------- */
export type AnalyticsEvent =
  | "profile_view"
  | "service_view"
  | "quote_click"
  | "share_click"
  | "copy_link"
  | "whatsapp_share"
  | "qr_open"
  | "request_from_profile"
  | "hire_from_profile";

const SOURCES = ["direct", "link", "whatsapp", "qr", "invite", "search", "social"];
const SOURCE_KEY = "hire.src";
const ORIGIN_KEY = "hire.origin";

const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* aba privada/bloqueada */ } },
};

/** Origem da visita: ?src= da URL (lembrada na sessão) ou "direct" */
export function currentSource() {
  const fromUrl = new URLSearchParams(window.location.search).get("src") ?? "";
  if (SOURCES.includes(fromUrl)) {
    session.set(SOURCE_KEY, fromUrl);
    return fromUrl;
  }
  return session.get(SOURCE_KEY) ?? "direct";
}

export function track(event: AnalyticsEvent, data: { providerId?: number; serviceId?: number } = {}) {
  const body = JSON.stringify({ event, ...data, source: currentSource() });
  const url = `${LOCAL_PORT}/analytics/event`;
  // keepalive: o envio continua mesmo se a pessoa trocar de página
  // (sendBeacon não serve: JSON para outra origem é bloqueado pelo navegador)
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/** Visualização: conta uma vez por sessão para o mesmo perfil/serviço */
export function trackView(event: "profile_view" | "service_view", data: { providerId?: number; serviceId?: number }) {
  const key = `hire.viewed.${event}.${data.providerId ?? 0}.${data.serviceId ?? 0}`;
  if (session.get(key)) return;
  session.set(key, "1");
  track(event, data);
}

/** Guarda que a visita passou pelo perfil público deste prestador (para atribuir pedidos) */
export function rememberProfileOrigin(providerId: number) {
  session.set(ORIGIN_KEY, String(providerId));
}

/** Pedido/contratação veio de um perfil público visto nesta sessão? */
export function cameFromProfile(providerId?: number | null) {
  return !!providerId && session.get(ORIGIN_KEY) === String(providerId);
}
