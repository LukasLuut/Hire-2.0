const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata valores em reais: 120.5 → "R$ 120,50". Aceita número ou string numérica. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return currency.format(n);
}

/** Formata datas ISO/Date para "24/09/2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T00:00:00" : value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
