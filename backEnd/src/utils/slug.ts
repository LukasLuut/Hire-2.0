/**
 * Slug legível para URLs públicas: "Souza Elétrica" → "souza-eletrica".
 * Só letras minúsculas sem acento, números e hífens; no máximo 60 caracteres.
 * Um slug só com números ganharia a cara de um id, então recebe o prefixo "p-".
 */
export function toSlug(text: unknown, fallback = "perfil") {
  const base = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const slug = base || fallback;
  return /^\d+$/.test(slug) ? `p-${slug}` : slug;
}

/** Aceita apenas o formato gerado por toSlug (evita consultas com texto arbitrário) */
export const isSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;

/**
 * Primeiro slug livre: "souza-eletrica", "souza-eletrica-2", "souza-eletrica-3"...
 * `taken` diz se o candidato já pertence a outro registro.
 */
export async function uniqueSlug(text: unknown, taken: (candidate: string) => Promise<boolean>, fallback?: string) {
  const base = toSlug(text, fallback);
  if (!(await taken(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 56)}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base.slice(0, 50)}-${Date.now().toString(36)}`;
}
