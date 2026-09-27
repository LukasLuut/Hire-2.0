/**
 * Situação de atendimento do prestador escolhida por ele:
 * - "available": aberto;
 * - "paused" sem data: fechado até reabrir manualmente;
 * - "paused" com closedUntil: fechado até a data (férias, recesso) — reabre sozinho no dia.
 * "Fora do horário" não é um status: é calculado pelo expediente (Availability) e só informa.
 */
export type OpenState = { open: boolean; closedUntil: Date | null };

export function openState(p: { status?: string | null; closedUntil?: Date | string | null } | null | undefined, now = new Date()): OpenState {
  if (!p || p.status !== "paused") return { open: true, closedUntil: null };
  const until = p.closedUntil ? new Date(p.closedUntil) : null;
  if (until && until.getTime() <= now.getTime()) return { open: true, closedUntil: null }; // a data passou: reabriu
  return { open: false, closedUntil: until };
}

/** Mensagem para quem tenta contratar/pedir orçamento com o prestador fechado */
export function closedMessage(state: OpenState) {
  return state.closedUntil
    ? `Este profissional está fechado até ${state.closedUntil.toLocaleDateString("pt-BR")}. Você pode agendar para depois dessa data ou enviar uma mensagem.`
    : "Este profissional está fechado no momento e não recebe novos pedidos. Você pode enviar uma mensagem.";
}
