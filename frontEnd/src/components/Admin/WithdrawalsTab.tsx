import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { walletAPI, PIX_LABEL, WITHDRAWAL_LABEL, type Withdrawal } from "../../api/WalletAPI";
import { useToast } from "../Toast/ToastContext";
import ConfirmModal from "../Common/ConfirmModal";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { adminBtn, adminInput } from "./adminStyles";

/** Administração: saques dos prestadores (simulados) — processar, pagar ou recusar com motivo. */
export default function WithdrawalsTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("SOLICITADO");
  const [list, setList] = useState<Withdrawal[] | null>(null);
  const [refusing, setRefusing] = useState<Withdrawal | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setList(null);
    walletAPI.adminList(status).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar saques."), "error"));
  }, [status, showToast]);
  useEffect(load, [load]);

  const act = async (w: Withdrawal, action: "process" | "pay" | "refuse") => {
    setBusy(true);
    try {
      await walletAPI.adminAdvance(w.id, action, note);
      showToast(action === "pay" ? "Saque marcado como pago." : action === "refuse" ? "Saque recusado; o valor voltou ao saldo." : "Saque em processamento.", "success");
      setRefusing(null);
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível atualizar."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-sm text-[var(--text-muted)] mb-3">Saques simulados. Em desenvolvimento eles também andam sozinhos (em processamento após 1 min, pagos após mais 2 min).</p>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-[var(--text-muted)]">Situação</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={adminInput}>
          {Object.entries(WITHDRAWAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="">Todos</option>
        </select>
      </label>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum saque.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((w) => (
            <li key={w.id} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-56">
                <p className="font-semibold">{formatCurrency(w.amount)} · {w.provider?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  #{w.id} · {PIX_LABEL[w.pixKeyType]} {w.pixKey} · pedido em {formatDateTime(w.requestedAt)} · {WITHDRAWAL_LABEL[w.status]}
                  {w.transactionCode ? ` · ${w.transactionCode}` : ""}{w.note ? ` · ${w.note}` : ""}
                </p>
              </div>
              {w.status === "SOLICITADO" && <button className={adminBtn()} disabled={busy} onClick={() => act(w, "process")}>Processar</button>}
              {(w.status === "SOLICITADO" || w.status === "EM_PROCESSAMENTO") && (
                <>
                  <button className={adminBtn(true)} disabled={busy} onClick={() => act(w, "pay")}>Marcar como pago</button>
                  <button className={adminBtn(false, true)} disabled={busy} onClick={() => { setNote(""); setRefusing(w); }}>Recusar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {refusing && (
        <ConfirmModal open danger title="Recusar saque?" confirmLabel="Recusar" cancelLabel="Voltar" loading={busy} onConfirm={() => act(refusing, "refuse")} onClose={() => setRefusing(null)}
          description="O valor volta para o saldo do prestador, que recebe o motivo.">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder="Ex.: chave Pix não pertence ao titular da conta" className={`w-full ${adminInput} resize-none`} aria-label="Motivo" />
        </ConfirmModal>
      )}
    </>
  );
}
