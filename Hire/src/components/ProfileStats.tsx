import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { apiRequest } from "../api/ApiClient";

/* --------------------------------------------------------------------------
 * ProfileStats — números do perfil público do prestador (últimos 30 dias).
 * Vem de contadores agregados (sem dados de quem visitou).
 * -------------------------------------------------------------------------- */
type Stats = { days: number; totals: Record<string, number>; viewSources: Record<string, number> };

const SOURCE_LABEL: Record<string, string> = {
  direct: "direto", link: "link", whatsapp: "WhatsApp", qr: "QR Code", invite: "convite", search: "busca", social: "redes sociais",
};

export default function ProfileStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    apiRequest<Stats>("/analytics/me?days=30", { headers: { Authorization: "Bearer " + token } })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  const t = stats?.totals ?? {};
  const rows: [string, number][] = [
    ["Visitas ao perfil", t.profile_view ?? 0],
    ["Visualizações de serviços", t.service_view ?? 0],
    ["Cliques em contratar/orçamento", t.quote_click ?? 0],
    ["Compartilhamentos", (t.share_click ?? 0) + (t.copy_link ?? 0) + (t.whatsapp_share ?? 0)],
    ["Pedidos vindos do perfil", (t.request_from_profile ?? 0) + (t.hire_from_profile ?? 0)],
  ];
  const sources = Object.entries(stats?.viewSources ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <section aria-labelledby="stats-title" className="mb-4 bg-[var(--bg-light)]/40 rounded-2xl p-4 border border-[var(--border)]">
      <h3 id="stats-title" className="font-semibold flex items-center gap-2 mb-2">
        <BarChart3 size={18} className="text-[var(--primary)]" /> Seu perfil nos últimos 30 dias
      </h3>
      {!stats ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-1 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {sources.length > 0 ? (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Origem das visitas: {sources.map(([s, n]) => `${SOURCE_LABEL[s] ?? s} ${n}`).join(" · ")}
            </p>
          ) : (
            <p className="text-xs text-[var(--text-muted)] mt-2">Ainda sem visitas. Compartilhe seu perfil para começar.</p>
          )}
        </>
      )}
    </section>
  );
}
