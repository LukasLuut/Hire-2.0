import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { apiRequest } from "../../api/ApiClient";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency } from "../../utils/format";
import { adminInput, adminBtn } from "./adminStyles";

type Summary = {
  days: number;
  hires: { created: number; completed: number; cancelled: number; expired: number; lateCancels: number; completionRate: number; cancelRate: number };
  money: { gmv: number; revenue: number; refunded: number; averageTicket: number };
  quotes: { requests: number; formalized: number; conversionRate: number };
  rating: { average: number; count: number };
  people: { newUsers: number; newProviders: number };
  categories: { name: string; hires: number; completed: number; volume: number }[];
  daily: { day: string; hires: number; completed: number }[];
};

const pct = (n: number) => `${n.toLocaleString("pt-BR")}%`;
const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

/** Relatórios da plataforma: indicadores do período, categorias e pedidos por dia; exporta CSV. */
export default function SummaryTab() {
  const { showToast } = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    setData(null);
    apiRequest<Summary>(`/admin/summary?days=${days}`, { headers: auth() })
      .then(setData)
      .catch((e) => showToast(getErrorMessage(e, "Erro ao carregar relatórios."), "error"));
  }, [days, showToast]);

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Indicador", "Valor"],
      ["Período (dias)", data.days],
      ["Pedidos criados", data.hires.created],
      ["Pedidos concluídos", data.hires.completed],
      ["Taxa de conclusão (%)", data.hires.completionRate],
      ["Pedidos cancelados", data.hires.cancelled],
      ["Taxa de cancelamento (%)", data.hires.cancelRate],
      ["Pedidos expirados", data.hires.expired],
      ["Pedidos de orçamento", data.quotes.requests],
      ["Orçamentos que viraram contrato", data.quotes.formalized],
      ["Conversão de orçamentos (%)", data.quotes.conversionRate],
      ["Volume pago (R$)", data.money.gmv],
      ["Receita da plataforma (R$)", data.money.revenue],
      ["Estornado (R$)", data.money.refunded],
      ["Ticket médio (R$)", data.money.averageTicket],
      ["Nota média", data.rating.average],
      ["Avaliações", data.rating.count],
      ["Novos usuários", data.people.newUsers],
      ["Novos prestadores", data.people.newProviders],
      [],
      ["Categoria", "Pedidos", "Concluídos", "Volume concluído (R$)"],
      ...data.categories.map((c) => [c.name, c.hires, c.completed, c.volume]),
      [],
      ["Dia", "Pedidos", "Concluídos"],
      ...data.daily.map((d) => [d.day, d.hires, d.completed]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hire-relatorio-${data.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const max = Math.max(1, ...(data?.daily ?? []).map((d) => d.hires));
  const cards: [string, string, string][] = data
    ? [
        ["Pedidos", String(data.hires.created), `${pct(data.hires.completionRate)} concluídos · ${pct(data.hires.cancelRate)} cancelados`],
        ["Orçamentos → contrato", pct(data.quotes.conversionRate), `${data.quotes.formalized} de ${data.quotes.requests} pedidos de orçamento`],
        ["Volume pago", formatCurrency(data.money.gmv), `ticket médio ${formatCurrency(data.money.averageTicket)}`],
        ["Receita da plataforma", formatCurrency(data.money.revenue), `estornado ${formatCurrency(data.money.refunded)}`],
        ["Nota média", data.rating.count ? data.rating.average.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) : "—", `${data.rating.count} avaliação(ões) de clientes`],
        ["Novas contas", String(data.people.newUsers), `${data.people.newProviders} novo(s) perfil(is) profissional(is)`],
      ]
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-muted)]">Período</span>
          <select className={adminInput} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>12 meses</option>
          </select>
        </label>
        <button className={`${adminBtn()} flex items-center gap-2`} onClick={exportCsv} disabled={!data}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      {!data ? <Loader2 className="animate-spin" /> : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {cards.map(([label, value, hint]) => (
              <div key={label} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
                <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                <dd className="text-2xl font-semibold mt-1">{value}</dd>
                <dd className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</dd>
              </div>
            ))}
          </dl>

          <h3 className="font-semibold mb-2">Pedidos por dia</h3>
          {data.daily.length === 0 ? <p className="text-sm text-[var(--text-muted)] mb-6">Sem pedidos no período.</p> : (
            <div className="mb-6 p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] overflow-x-auto">
              <div className="flex items-end gap-1 h-32 min-w-max" role="img" aria-label="Pedidos por dia no período">
                {data.daily.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1" title={`${d.day}: ${d.hires} pedido(s), ${d.completed} concluído(s)`}>
                    <div className="w-5 rounded-t bg-[var(--primary)]/40 relative" style={{ height: `${(d.hires / max) * 100}px` }}>
                      <div className="absolute bottom-0 inset-x-0 rounded-t bg-[var(--primary)]" style={{ height: `${d.hires ? (d.completed / d.hires) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">Barra clara: pedidos criados · parte escura: concluídos.</p>
            </div>
          )}

          <h3 className="font-semibold mb-2">Categorias</h3>
          {data.categories.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Sem pedidos no período.</p> : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-light)] text-left text-[var(--text-muted)]">
                  <tr><th className="p-2 font-medium">Categoria</th><th className="p-2 font-medium text-right">Pedidos</th><th className="p-2 font-medium text-right">Concluídos</th><th className="p-2 font-medium text-right">Volume concluído</th></tr>
                </thead>
                <tbody>
                  {data.categories.map((c) => (
                    <tr key={c.name} className="border-t border-[var(--border)]">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-right">{c.hires}</td>
                      <td className="p-2 text-right">{c.completed}</td>
                      <td className="p-2 text-right">{formatCurrency(c.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
