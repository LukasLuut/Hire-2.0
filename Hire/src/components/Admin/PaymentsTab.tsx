import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest } from "../../api/ApiClient";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { METHOD_LABEL } from "../../utils/payment";
import type { PaymentMethod } from "../../interfaces/Entities";

type Overview = {
  feePercent: number;
  totals: { status: "PAGO" | "LIBERADO" | "ESTORNADO"; count: number; amount: number; fee: number }[];
  payments: {
    id: number;
    hireId: number | null;
    service: string | null;
    client: string | null;
    provider: string | null;
    amount: number;
    fee: number;
    net: number;
    method: PaymentMethod;
    status: "PAGO" | "LIBERADO" | "ESTORNADO";
    transactionCode: string;
    paidAt: string;
  }[];
};

const STATUS: Record<string, string> = { PAGO: "Retido", LIBERADO: "Liberado", ESTORNADO: "Estornado" };
const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

/** Administração: pagamentos (simulados) — totais por situação, receita da plataforma e lista recente. */
export default function PaymentsTab() {
  const { showToast } = useToast();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    apiRequest<Overview>("/payments", { headers: auth() })
      .then(setData)
      .catch((e) => showToast(getErrorMessage(e, "Erro ao carregar pagamentos."), "error"));
  }, [showToast]);

  if (!data) return <Loader2 className="animate-spin" />;
  const of = (s: string) => data.totals.find((t) => t.status === s);
  const cards: [string, string, string?][] = [
    ["Retido (aguardando conclusão)", formatCurrency(of("PAGO")?.amount ?? 0), `${of("PAGO")?.count ?? 0} pagamento(s)`],
    ["Liberado aos prestadores", formatCurrency((of("LIBERADO")?.amount ?? 0) - (of("LIBERADO")?.fee ?? 0)), `${of("LIBERADO")?.count ?? 0} pagamento(s)`],
    ["Receita da plataforma", formatCurrency(of("LIBERADO")?.fee ?? 0), `taxa de ${data.feePercent}% sobre os liberados`],
    ["Estornado", formatCurrency(of("ESTORNADO")?.amount ?? 0), `${of("ESTORNADO")?.count ?? 0} pagamento(s)`],
  ];

  return (
    <>
      <p className="text-sm text-[var(--text-muted)] mb-4">Pagamentos simulados: nenhum valor é cobrado de verdade.</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
            <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
            <dd className="text-xl font-semibold mt-1">{value}</dd>
            {hint && <dd className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</dd>}
          </div>
        ))}
      </dl>
      {data.payments.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum pagamento ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-light)] text-left text-[var(--text-muted)]">
              <tr>
                <th className="p-2 font-medium">Data</th>
                <th className="p-2 font-medium">Pedido</th>
                <th className="p-2 font-medium">Cliente → Prestador</th>
                <th className="p-2 font-medium">Forma</th>
                <th className="p-2 font-medium text-right">Valor</th>
                <th className="p-2 font-medium text-right">Taxa</th>
                <th className="p-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="p-2 whitespace-nowrap">{formatDateTime(p.paidAt)}</td>
                  <td className="p-2">
                    {p.hireId ? String(p.hireId).padStart(4, "0") : "—"} · {p.service ?? "—"}
                    <span className="block text-xs text-[var(--text-muted)]">{p.transactionCode}</span>
                  </td>
                  <td className="p-2">{p.client ?? "—"} → {p.provider ?? "—"}</td>
                  <td className="p-2">{METHOD_LABEL[p.method]}</td>
                  <td className="p-2 text-right whitespace-nowrap">{formatCurrency(p.amount)}</td>
                  <td className="p-2 text-right whitespace-nowrap">{formatCurrency(p.fee)}</td>
                  <td className="p-2">{STATUS[p.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
