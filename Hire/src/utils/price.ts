import { formatCurrency } from "./format";

export type PriceUnit = "fixo" | "a_partir_de" | "hora" | "m2" | "visita" | "orcamento";

export interface ServicePackage {
  name: string;
  description: string;
  price: number;
}

/** Opções do "Como você cobra" */
export const PRICE_UNITS: { value: PriceUnit; label: string; hint: string }[] = [
  { value: "fixo", label: "Preço fixo", hint: "Um valor fechado pelo serviço" },
  { value: "a_partir_de", label: "A partir de", hint: "Valor mínimo; o cliente pede orçamento" },
  { value: "hora", label: "Por hora", hint: "O cliente informa quantas horas" },
  { value: "m2", label: "Por m²", hint: "O cliente informa a área" },
  { value: "visita", label: "Por visita", hint: "Valor de cada visita/atendimento" },
  { value: "orcamento", label: "Sob orçamento", hint: "Sem preço fixo; o cliente pede orçamento" },
];

/** "a partir de" e "sob orçamento": sem contratação direta, só pedido de orçamento */
export const isQuoteOnly = (unit?: string | null) => unit === "a_partir_de" || unit === "orcamento";

/** Precisa de quantidade na contratação (horas ou m²) */
export const needsQuantity = (unit?: string | null) => unit === "hora" || unit === "m2";

/** Texto do preço conforme a unidade: "R$ 80,00 / hora", "A partir de R$ 150,00"... */
export function formatServicePrice(price: number, unit?: string | null, packages?: ServicePackage[] | null) {
  if (packages?.length) {
    const min = Math.min(...packages.map((p) => p.price));
    return `A partir de ${formatCurrency(min)}`;
  }
  switch (unit) {
    case "a_partir_de":
      return `A partir de ${formatCurrency(price)}`;
    case "hora":
      return `${formatCurrency(price)} / hora`;
    case "m2":
      return `${formatCurrency(price)} / m²`;
    case "visita":
      return `${formatCurrency(price)} / visita`;
    case "orcamento":
      return price > 0 ? `Sob orçamento (ref. ${formatCurrency(price)})` : "Sob orçamento";
    default:
      return formatCurrency(price);
  }
}
