import { CalendarClock, FileText, Timer, Wallet, Store, MessageSquareQuote, PencilRuler, type LucideIcon } from "lucide-react";
import type { ConversationSummary, Negotiation, NegotiationOrigin, Party } from "../../interfaces/Entities";
import { avatarFor } from "../../utils/avatar";

/* --------------------------------------------------------------------------
 * Peças visuais compartilhadas do chat: nomes, horários, ícones e movimento.
 * -------------------------------------------------------------------------- */

/** Curva e durações do chat (entrada desacelera; saída é mais rápida) */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const DUR = { micro: 0.14, small: 0.2, panel: 0.28 } as const;

export function partyName(c: Pick<ConversationSummary, "client" | "provider"> | null | undefined, party: Party) {
  if (party === "cliente") return c?.client?.name || "Cliente";
  return c?.provider?.companyName || c?.provider?.professionalName || "Prestador";
}

/** Nome, foto e papel da outra parte */
export function counterpartOf(c: ConversationSummary) {
  const party: Party = c.myRole === "cliente" ? "prestador" : "cliente";
  const name = partyName(c, party);
  const photo = party === "prestador" ? c.provider?.profileImageUrl ?? null : c.client?.avatarUrl ?? null;
  return { party, name, avatar: avatarFor(photo, name), roleLabel: party === "prestador" ? "Prestador" : "Cliente" };
}

export const firstName = (name: string) => name.split(" ")[0] || name;

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Hoje", "Ontem" ou a data, para separar os dias da conversa */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

/** Hora curta para a lista: hoje = hora; esta semana = dia; antes = data */
export function listTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeLabel(iso);
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Ícone e texto de apoio de cada tópico */
export const TOPIC_META: Record<string, { icon: LucideIcon; placeholder: string; multiline?: boolean }> = {
  service: { icon: FileText, placeholder: "O que será feito, o que está incluso…", multiline: true },
  payment: { icon: Wallet, placeholder: "Ex.: R$ 250,00 · Pix" },
  start: { icon: CalendarClock, placeholder: "Ex.: Segunda, 10/10 às 14:00" },
  duration: { icon: Timer, placeholder: "Ex.: 3 horas" },
};

export const ORIGIN_META: Record<NegotiationOrigin, { icon: LucideIcon; label: string }> = {
  servico: { icon: Store, label: "Serviço do catálogo" },
  pedido: { icon: MessageSquareQuote, label: "Pedido do cliente" },
  sob_medida: { icon: PencilRuler, label: "Proposta sob medida" },
};

/** Tópicos que as partes acordam (o "Finalizar" é só o botão do fim) */
export const dealTopics = (n: Negotiation) => n.topics.filter((t) => t.key !== "finalize");

export function progressOf(n: Negotiation) {
  const topics = dealTopics(n);
  const agreed = topics.filter((t) => t.state === "Acordado").length;
  return { agreed, total: topics.length, ratio: topics.length ? agreed / topics.length : 0 };
}

/** Situação curta de uma negociação, do ponto de vista de quem vê */
export function negotiationStatus(n: Negotiation, me: Party | null, other: string): { text: string; tone: "wait" | "ok" | "no" | "mine" | "muted" } {
  if (n.status === "FORMALIZED") return { text: `Contrato ${n.contractCode ?? "gerado"}`, tone: "ok" };
  if (n.status === "CLOSED") return { text: n.requestStatus === "RECUSADA" ? "Pedido recusado" : "Encerrada", tone: "no" };
  if (me && n.waitingFor === me) return { text: "Aguardando você", tone: "wait" };
  if (n.waitingFor) return { text: `Aguardando ${firstName(other)}`, tone: "mine" };
  return { text: "Pronta para aceitar", tone: "ok" };
}

export const TONE_CLASS: Record<"wait" | "ok" | "no" | "mine" | "muted", string> = {
  wait: "text-[var(--deal-wait)] bg-[color-mix(in_oklch,var(--deal-wait)_14%,transparent)] border-[color-mix(in_oklch,var(--deal-wait)_35%,transparent)]",
  ok: "text-[var(--deal-ok)] bg-[color-mix(in_oklch,var(--deal-ok)_14%,transparent)] border-[color-mix(in_oklch,var(--deal-ok)_35%,transparent)]",
  no: "text-[var(--deal-no)] bg-[color-mix(in_oklch,var(--deal-no)_12%,transparent)] border-[color-mix(in_oklch,var(--deal-no)_30%,transparent)]",
  mine: "text-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] border-[color-mix(in_oklch,var(--primary)_35%,transparent)]",
  muted: "text-[var(--text-muted)] bg-[var(--bg)] border-[var(--border-muted)]",
};
