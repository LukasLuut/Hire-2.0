import { track } from "./analytics";

/* --------------------------------------------------------------------------
 * Compartilhamento — lógica única usada no perfil público, no painel do
 * prestador e na página do serviço. Cada canal marca a origem (?src=) para as
 * métricas de aquisição. Compartilhar é evento; não conta como indicação.
 * -------------------------------------------------------------------------- */
export type ShareTarget = { url: string; title: string; text: string; providerId?: number; serviceId?: number };

/** Mesma URL com ?src=<canal> (substitui um src anterior) */
export function withSource(url: string, source: "link" | "whatsapp" | "qr" | "social") {
  const u = new URL(url, window.location.origin);
  u.searchParams.set("src", source);
  return u.toString();
}

export const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Folha de compartilhamento do sistema (celular). false = cancelado/indisponível */
export async function nativeShare(t: ShareTarget) {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ title: t.title, text: t.text, url: withSource(t.url, "social") });
    track("share_click", { providerId: t.providerId, serviceId: t.serviceId });
    return true;
  } catch {
    return false; // pessoa fechou a folha
  }
}

/** Copia o link; cai para seleção manual em navegadores sem clipboard */
export async function copyLink(t: ShareTarget) {
  const url = withSource(t.url, "link");
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) return false;
  }
  track("copy_link", { providerId: t.providerId, serviceId: t.serviceId });
  return true;
}

/** Link do WhatsApp (app no celular, WhatsApp Web no computador) */
export function whatsappHref(t: ShareTarget) {
  return `https://wa.me/?text=${encodeURIComponent(`${t.text}\n${withSource(t.url, "whatsapp")}`)}`;
}

export function trackWhatsapp(t: ShareTarget) {
  track("whatsapp_share", { providerId: t.providerId, serviceId: t.serviceId });
}
