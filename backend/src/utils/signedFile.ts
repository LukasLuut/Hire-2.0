import crypto from "crypto";
import { jwtSecret } from "./jwt";

/**
 * Links temporários para arquivos privados (anexos da negociação).
 * A API só entrega o link a quem participa da conversa; o link expira e não pode ser
 * alterado para outro arquivo (assinatura HMAC com o segredo do servidor).
 */
const PREFIX = "private:";
const TTL_MS = 2 * 60 * 60 * 1000;

const signature = (name: string, exp: number) =>
  crypto.createHmac("sha256", jwtSecret()).update(`${name}:${exp}`).digest("base64url");

/** Valor gravado no banco para um arquivo privado */
export const privateRef = (filename: string) => PREFIX + filename;

/** Converte o valor do banco em link: arquivo privado → link assinado; arquivo antigo público → como está. */
export function fileUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const name = stored.slice(PREFIX.length);
  const exp = Date.now() + TTL_MS;
  return `/files/c/${encodeURIComponent(name)}?exp=${exp}&sig=${signature(name, exp)}`;
}

export function validSignature(name: string, exp: unknown, sig: unknown): boolean {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now() || typeof sig !== "string") return false;
  const expected = Buffer.from(signature(name, e));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
