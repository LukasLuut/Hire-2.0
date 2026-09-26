/** Texto sem acento e em minúsculas, para comparar buscas */
export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// palavras que não ajudam a achar serviço
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "para", "com", "por", "um", "uma"]);

/**
 * Todas as palavras da busca aparecem em algum dos textos (em qualquer ordem, sem acento).
 * "banho e tosa" acha "Tosa higiênica e banho".
 */
export function matchesSearch(query: string, ...texts: (string | null | undefined)[]) {
  const words = normalize(query).split(/\s+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return true;
  const haystack = normalize(texts.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}
