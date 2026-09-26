import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiRequest } from "../api/ApiClient";

type AgendaItem = {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  service: string;
  client: string | null;
  status: string;
  status_provider: string;
  place: string | null;
};

const p = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const STATUS: Record<string, string> = { PENDENTE: "aguardando seu aceite", ACEITO: "aceito", "EM ANDAMENTO": "em andamento", CONCLUIDO: "entregue" };

/**
 * Agenda da semana do prestador: atendimentos marcados, dia a dia, com navegação entre semanas.
 * Cada item leva aos pedidos recebidos.
 */
export default function ProviderAgenda() {
  const navigate = useNavigate();
  const [start, setStart] = useState(() => startOfDay(new Date()));
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setItems(null);
    apiRequest<{ items: AgendaItem[] }>(`/providers/me/agenda?start=${dayKey(start)}&days=7`, { headers: { Authorization: "Bearer " + token } })
      .then((r) => setItems(r?.items ?? []))
      .catch(() => setError(true));
  }, [start]);

  // dias da semana com atendimentos, na ordem
  const days = useMemo(() => {
    const byDay = new Map<string, AgendaItem[]>();
    for (const it of items ?? []) {
      const k = dayKey(new Date(it.scheduledAt));
      byDay.set(k, [...(byDay.get(k) ?? []), it]);
    }
    return [...byDay.entries()];
  }, [items]);

  if (error) return null;
  const end = new Date(start.getTime() + 6 * 86400000);
  const label = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  const isThisWeek = dayKey(start) === dayKey(startOfDay(new Date()));

  return (
    <section aria-labelledby="agenda-title" className="mb-4 rounded-2xl p-4 border border-[var(--border)] bg-[var(--bg-light)]/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 id="agenda-title" className="font-semibold flex items-center gap-2">
          <CalendarDays size={18} className="text-[var(--primary)]" /> Agenda
        </h3>
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <button type="button" aria-label="Semana anterior" disabled={isThisWeek} onClick={() => setStart(new Date(start.getTime() - 7 * 86400000))} className="p-1 rounded hover:text-[var(--text)] disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span aria-live="polite">{label}</span>
          <button type="button" aria-label="Próxima semana" onClick={() => setStart(new Date(start.getTime() + 7 * 86400000))} className="p-1 rounded hover:text-[var(--text)]">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {!items ? (
        <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Carregando agenda" />
      ) : days.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum atendimento marcado nesta semana.</p>
      ) : (
        <ol className="space-y-3">
          {days.map(([k, list]) => (
            <li key={k}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                {new Date(list[0].scheduledAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
              </p>
              <ul className="space-y-1.5">
                {list.map((it) => {
                  const from = new Date(it.scheduledAt);
                  const to = new Date(from.getTime() + it.durationMinutes * 60000);
                  const time = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <li key={it.id}>
                      <button type="button" onClick={() => navigate("/progress")} className="w-full text-left p-2 rounded-lg bg-[var(--bg)]/60 border border-[var(--border)] hover:border-[var(--primary)] transition">
                        <span className="block text-sm font-medium">
                          {time(from)}–{time(to)} · {it.service}
                        </span>
                        <span className="block text-xs text-[var(--text-muted)] truncate">
                          {[it.client, STATUS[it.status === "CONCLUIDO" ? "CONCLUIDO" : it.status_provider], it.place].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
