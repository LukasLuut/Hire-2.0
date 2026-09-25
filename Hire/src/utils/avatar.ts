import { LOCAL_PORT } from "../api/ApiClient";

/** Avatar padrão gerado pelo DiceBear (estilo miniavs), estável para a mesma semente. */
export function defaultAvatar(seed?: string | number | null): string {
  const s = String(seed ?? "hire").trim().toLowerCase() || "hire";
  return `https://api.dicebear.com/9.x/miniavs/svg?seed=${encodeURIComponent(s)}`;
}

/** URL absoluta de um arquivo enviado ao backend (/uploads/...) ou null. */
export function uploadUrl(path?: string | null): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${LOCAL_PORT}${path}`;
}

/** Foto enviada pelo usuário ou, na falta dela, o avatar padrão da pessoa. */
export function avatarFor(path: string | null | undefined, seed: string | number | null | undefined): string {
  return uploadUrl(path) ?? defaultAvatar(seed);
}
