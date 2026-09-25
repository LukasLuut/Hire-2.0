// Dias na ordem de Date.getDay() (0 = domingo), mesmas chaves usadas na disponibilidade do prestador
export const WEEK_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Normaliza a agenda recebida do formulário (string JSON ou objeto); descarta dias e horários inválidos. */
export function parseSlots(raw: unknown): Record<string, string[]> | null {
  if (raw === undefined || raw === null || raw === "") return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("Agenda inválida");
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Agenda inválida");

  const result: Record<string, string[]> = {};
  for (const day of WEEK_DAYS) {
    const times = (value as Record<string, unknown>)[day];
    if (!Array.isArray(times)) continue;
    const valid = [...new Set(times.map(String).filter((t) => TIME.test(t)))].sort();
    if (valid.length) result[day] = valid;
  }
  return Object.keys(result).length ? result : null;
}

/**
 * Lê "AAAA-MM-DDTHH:mm" como horário local (o mesmo que o cliente viu na tela).
 * Retorna null se o texto não estiver nesse formato.
 */
export function parseLocalDateTime(text: unknown): Date | null {
  const m = String(text ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** O horário cai em um dos inícios oferecidos na agenda do serviço? */
export function fitsSchedule(slots: Record<string, string[]> | null | undefined, date: Date) {
  if (!slots) return false;
  const day = WEEK_DAYS[date.getDay()];
  const hhmm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return (slots[day] ?? []).includes(hhmm);
}
