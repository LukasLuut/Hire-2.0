import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { apiRequest } from "../../api/ApiClient";
import { formatCurrency } from "../../utils/format";

type Earnings = { pending: number; available: number; fees: number; feePercent: number };

/**
 * Valores do prestador vindos dos pagamentos (simulados): a receber = pagos, aguardando o cliente
 * confirmar a conclusão; liberado = já repassado. Base da futura carteira.
 */
export default function EarningsSummary() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    apiRequest<Earnings>("/providers/me/earnings", { headers: { Authorization: "Bearer " + token } })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  return (
    <section aria-labelledby="earnings-title" className="mb-4 bg-[var(--bg-light)]/40 rounded-2xl p-4 border border-[var(--border)]">
      <h3 id="earnings-title" className="font-semibold flex items-center gap-2 mb-2">
        <Wallet size={18} className="text-[var(--primary)]" /> Seus valores
      </h3>
      {!data ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">A receber (aguardando conclusão)</dt>
              <dd className="font-semibold">{formatCurrency(data.pending)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Liberado</dt>
              <dd className="font-semibold">{formatCurrency(data.available)}</dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Valores já descontada a taxa da Hire ({data.feePercent}%). Pagamentos simulados no ambiente de demonstração.
          </p>
        </>
      )}
    </section>
  );
}
