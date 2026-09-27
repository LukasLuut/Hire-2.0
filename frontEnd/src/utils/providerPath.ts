/**
 * Endereço público do perfil do prestador. Com slug: /prestador/<slug> (canônico);
 * sem slug (dados antigos): /provider/<id>, que redireciona para o canônico.
 */
export function providerPath(p: { id?: number | null; slug?: string | null } | null | undefined) {
  if (p?.slug) return `/prestador/${p.slug}`;
  return `/provider/${p?.id ?? ""}`;
}

/** URL completa do perfil (para compartilhar e QR Code) */
export function providerUrl(p: { id?: number | null; slug?: string | null } | null | undefined) {
  return `${window.location.origin}${providerPath(p)}`;
}
