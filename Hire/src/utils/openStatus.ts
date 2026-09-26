import type { AvailabilityEntity } from "../interfaces/Entities";

/* --------------------------------------------------------------------------
 * Situação de atendimento do prestador, como o cliente vê:
 * - fechado (sem data) ou fechado até uma data (reabre sozinho no dia);
 * - aberto, mas fora do horário de atendimento agora (pelo expediente);
 * - aberto.
 * -------------------------------------------------------------------------- */
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_LABEL: Record<string, string> = { sunday: "dom", monday: "seg", tuesday: "ter", wednesday: "qua", thursday: "qui", friday: "sex", saturday: "sáb" };
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export type OpenInfo =
  | { kind: "closed"; label: string }
  | { kind: "closedUntil"; label: string; until: Date }
  | { kind: "outsideHours"; label: string }
  | { kind: "open"; label: string };

export function openInfo(p: { status?: string | null; closedUntil?: string | Date | null; availabilities?: AvailabilityEntity[] | null }, now = new Date()): OpenInfo {
  if (p.status === "paused") {
    const until = p.closedUntil ? new Date(p.closedUntil) : null;
    if (!until) return { kind: "closed", label: "Fechado" };
    if (until.getTime() > now.getTime()) {
      return { kind: "closedUntil", label: `Fechado até ${until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`, until };
    }
  }
  const hours = p.availabilities ?? [];
  if (hours.length) {
    const today = hours.find((a) => a.day === DAYS[now.getDay()]);
    const minute = now.getHours() * 60 + now.getMinutes();
    if (!today || minute < toMin(today.start) || minute >= toMin(today.end)) {
      // próxima abertura dentro de 7 dias
      for (let i = 0; i < 8; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const slot = hours.find((a) => a.day === DAYS[d.getDay()]);
        if (!slot) continue;
        if (i === 0 && minute >= toMin(slot.start)) continue;
        const when = i === 0 ? `hoje às ${slot.start}` : i === 1 ? `amanhã às ${slot.start}` : `${DAY_LABEL[slot.day]} às ${slot.start}`;
        return { kind: "outsideHours", label: `Fora do horário · abre ${when}` };
      }
      return { kind: "outsideHours", label: "Fora do horário" };
    }
  }
  return { kind: "open", label: "Aberto" };
}
