import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Loader2, RotateCcw, Wallet as WalletIcon, X } from "lucide-react";
import { walletAPI, PIX_LABEL, WITHDRAWAL_LABEL, type PixKeyType, type Wallet, type Withdrawal } from "../api/WalletAPI";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatCurrency, formatDateTime } from "../utils/format";

const field = "w-full p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--primary)]";
type Filter = "tudo" | "entradas" | "saques";

/* --------------------------------------------------------------------------
 * /carteira — carteira do prestador (valores simulados).
 * Saldo disponível, a receber, extrato e saques via Pix com acompanhamento do status.
 * -------------------------------------------------------------------------- */
export default function WalletPage() {
  const { provider, loading } = useSession();
  const { showToast } = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [filter, setFilter] = useState<Filter>("tudo");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [shown, setShown] = useState(20);

  const load = useCallback(() => {
    walletAPI.get().then(setWallet).catch((e) => showToast(getErrorMessage(e, "Não foi possível carregar a carteira."), "error"));
  }, [showToast]);
  useEffect(() => {
    if (!provider) return;
    load();
    // saques mudam de status sozinhos (processamento simulado): atualiza enquanto a página está aberta
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [provider, load]);

  const statement = useMemo(() => (wallet?.statement ?? []).filter((e) => filter === "tudo" || (filter === "saques" ? e.kind === "saque" : e.kind !== "saque")), [wallet, filter]);

  if (!loading && !provider) return <Navigate to="/home" replace />;

  const openWithdrawals = (wallet?.withdrawals ?? []).filter((w) => w.status === "SOLICITADO" || w.status === "EM_PROCESSAMENTO");
  const cancel = async (w: Withdrawal) => {
    try {
      await walletAPI.cancel(w.id);
      showToast("Saque cancelado. O valor voltou para o saldo.", "success");
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível cancelar."), "error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><WalletIcon className="text-[var(--primary)]" /> Carteira</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Valores dos seus serviços pagos pela Hire. Ambiente de demonstração: nenhum valor é real.</p>
          </div>
          <Link to="/business" className="text-sm text-[var(--primary)] hover:underline">Voltar ao Business</Link>
        </div>

        {!wallet ? <Loader2 className="animate-spin" /> : (
          <>
            {/* saldos */}
            <section aria-label="Saldos" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="md:col-span-1 p-5 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/40">
                <p className="text-sm text-[var(--text-muted)]">Disponível para saque</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(wallet.available)}</p>
                <button
                  onClick={() => setWithdrawOpen(true)}
                  disabled={wallet.available < wallet.minWithdrawal}
                  className="mt-4 w-full py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold disabled:opacity-50"
                >
                  Sacar via Pix
                </button>
                {wallet.available < wallet.minWithdrawal && <p className="text-xs text-[var(--text-muted)] mt-2">Saque mínimo: {formatCurrency(wallet.minWithdrawal)}</p>}
              </div>
              <div className="p-5 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
                <p className="text-sm text-[var(--text-muted)] flex items-center gap-2"><Clock size={14} /> A receber</p>
                <p className="text-2xl font-semibold mt-1">{formatCurrency(wallet.pending)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">Pagos pelos clientes; liberados quando eles confirmarem a conclusão.</p>
              </div>
              <div className="p-5 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
                <p className="text-sm text-[var(--text-muted)]">Total recebido</p>
                <p className="text-2xl font-semibold mt-1">{formatCurrency(wallet.released)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {formatCurrency(wallet.gross)} pagos − {formatCurrency(wallet.fees)} de taxa da Hire
                  {wallet.withdrawn > 0 && <> · {formatCurrency(wallet.withdrawn)} já sacados</>}
                  {wallet.inTransit > 0 && <> · {formatCurrency(wallet.inTransit)} em saque</>}
                </p>
              </div>
            </section>

            {/* saques em andamento */}
            {openWithdrawals.length > 0 && (
              <section aria-labelledby="open-withdrawals" className="mb-6">
                <h2 id="open-withdrawals" className="font-semibold mb-2">Saques em andamento</h2>
                <ul className="grid gap-3">
                  {openWithdrawals.map((w) => (
                    <li key={w.id} className="p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{formatCurrency(w.amount)} <span className="text-sm font-normal text-[var(--text-muted)]">→ {PIX_LABEL[w.pixKeyType]} {w.pixKey}</span></p>
                        {w.status === "SOLICITADO" && <button onClick={() => cancel(w)} className="text-sm text-[var(--text-muted)] hover:text-red-500">Cancelar</button>}
                      </div>
                      <WithdrawalSteps w={w} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* extrato */}
            <section aria-labelledby="statement-title">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 id="statement-title" className="font-semibold">Extrato</h2>
                <div role="tablist" aria-label="Filtrar extrato" className="flex gap-1 p-1 rounded-xl border border-[var(--border)] text-sm">
                  {(["tudo", "entradas", "saques"] as Filter[]).map((f) => (
                    <button key={f} role="tab" aria-selected={filter === f} onClick={() => { setFilter(f); setShown(20); }}
                      className={`px-3 py-1 rounded-lg capitalize ${filter === f ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {statement.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] p-6 text-center rounded-2xl border border-dashed border-[var(--border)]">
                  Nada por aqui ainda. Quando um cliente pagar um serviço, ele aparece neste extrato.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--bg-light)]">
                  {statement.slice(0, shown).map((e) => {
                    const Icon = e.kind === "saque" ? ArrowUpRight : e.kind === "estorno" ? RotateCcw : e.kind === "a_receber" ? Clock : ArrowDownLeft;
                    const tone = e.kind === "entrada" ? "text-green-500" : e.kind === "saque" ? "text-[var(--text)]" : "text-[var(--text-muted)]";
                    return (
                      <li key={e.id} className="flex items-center gap-3 p-3 sm:p-4">
                        <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-[var(--bg)] ${tone}`}><Icon size={16} aria-hidden /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{e.title}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{e.detail}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold ${tone}`}>
                            {e.kind === "estorno" ? "—" : `${e.amount > 0 ? "+" : e.amount < 0 ? "−" : ""}${formatCurrency(Math.abs(e.amount))}`}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{e.kind === "saque" ? WITHDRAWAL_LABEL[e.status as keyof typeof WITHDRAWAL_LABEL] ?? e.status : e.status} · {formatDateTime(e.date)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {statement.length > shown && (
                <button onClick={() => setShown((n) => n + 20)} className="mt-3 w-full py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] text-sm">
                  Mostrar mais ({statement.length - shown})
                </button>
              )}
            </section>
          </>
        )}
      </div>

      {wallet && (
        <WithdrawDialog
          open={withdrawOpen}
          wallet={wallet}
          onClose={() => setWithdrawOpen(false)}
          onDone={() => { setWithdrawOpen(false); load(); }}
        />
      )}
    </div>
  );
}

/** Solicitado → Em processamento → Pago (ou recusado) */
function WithdrawalSteps({ w }: { w: Withdrawal }) {
  const order: Withdrawal["status"][] = ["SOLICITADO", "EM_PROCESSAMENTO", "PAGO"];
  const current = order.indexOf(w.status);
  const dates = [w.requestedAt, w.processedAt, w.paidAt];
  return (
    <ol className="mt-3 grid grid-cols-3 gap-2 text-xs" aria-label="Situação do saque">
      {order.map((s, i) => (
        <li key={s} className="flex flex-col gap-1" aria-current={i === current ? "step" : undefined}>
          <span className={`h-1.5 rounded-full ${i <= current ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
          <span className={i <= current ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{WITHDRAWAL_LABEL[s]}</span>
          {dates[i] && <span className="text-[var(--text-muted)]">{formatDateTime(dates[i]!)}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Saque em etapas: valor → chave Pix → revisão → enviado */
function WithdrawDialog({ open, wallet, onClose, onDone }: { open: boolean; wallet: Wallet; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast();
  const [step, setStep] = useState<"amount" | "pix" | "review" | "done">("amount");
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Withdrawal | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("amount");
    setAmount("");
    setPixKeyType(wallet.lastPixKey?.type ?? "cpf");
    setPixKey(wallet.lastPixKey?.key ?? "");
    setResult(null);
  }, [open, wallet.lastPixKey]);

  const value = Number(amount.replace(",", "."));
  const amountError = !(value >= wallet.minWithdrawal) ? `Mínimo ${formatCurrency(wallet.minWithdrawal)}` : value > wallet.available ? `Disponível: ${formatCurrency(wallet.available)}` : "";

  const submit = async () => {
    setBusy(true);
    try {
      const w = await walletAPI.withdraw({ amount: value, pixKeyType, pixKey });
      setResult(w ?? null);
      setStep("done");
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível pedir o saque."), "error");
      setStep("pix");
    } finally {
      setBusy(false);
    }
  };

  const placeholder: Record<PixKeyType, string> = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", email: "voce@exemplo.com", telefone: "(51) 99999-9999", aleatoria: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="withdraw-title" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className="w-full max-w-md bg-[var(--bg-light)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 text-[var(--text)]">
            <div className="flex items-start justify-between">
              <h2 id="withdraw-title" className="text-xl font-semibold">Sacar via Pix</h2>
              {!busy && <button onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={20} /></button>}
            </div>

            {step === "amount" && (
              <form className="grid gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); if (!amountError) setStep("pix"); }}>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--text-muted)]">Quanto você quer sacar?</span>
                  <input className={`${field} text-2xl font-semibold`} inputMode="decimal" autoFocus placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!amount && !!amountError} />
                </label>
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>{amount && amountError ? <span className="text-red-500">{amountError}</span> : `Disponível: ${formatCurrency(wallet.available)}`}</span>
                  <button type="button" onClick={() => setAmount(wallet.available.toFixed(2).replace(".", ","))} className="text-[var(--primary)] hover:underline">Sacar tudo</button>
                </div>
                <button disabled={!!amountError} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold disabled:opacity-50">Continuar</button>
              </form>
            )}

            {step === "pix" && (
              <form className="grid gap-3 mt-4 text-sm" onSubmit={(e) => { e.preventDefault(); if (pixKey.trim()) setStep("review"); }}>
                <label className="grid gap-1">
                  <span className="text-[var(--text-muted)]">Tipo de chave</span>
                  <select className={field} value={pixKeyType} onChange={(e) => { setPixKeyType(e.target.value as PixKeyType); setPixKey(""); }}>
                    {(Object.keys(PIX_LABEL) as PixKeyType[]).map((k) => <option key={k} value={k}>{PIX_LABEL[k]}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[var(--text-muted)]">Chave Pix (precisa estar no seu nome)</span>
                  <input className={field} value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder={placeholder[pixKeyType]} autoFocus />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("amount")} className="flex-1 py-3 rounded-xl border border-[var(--border)]">Voltar</button>
                  <button disabled={!pixKey.trim()} className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold disabled:opacity-50">Revisar</button>
                </div>
              </form>
            )}

            {step === "review" && (
              <div className="grid gap-4 mt-4 text-sm">
                <dl className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] grid grid-cols-2 gap-y-2">
                  <dt className="text-[var(--text-muted)]">Valor</dt><dd className="text-right font-semibold">{formatCurrency(value)}</dd>
                  <dt className="text-[var(--text-muted)]">Chave</dt><dd className="text-right break-all">{PIX_LABEL[pixKeyType]} · {pixKey}</dd>
                  <dt className="text-[var(--text-muted)]">Tarifa</dt><dd className="text-right">Grátis</dd>
                  <dt className="text-[var(--text-muted)]">Prazo</dt><dd className="text-right">até 1 dia útil</dd>
                </dl>
                <div className="flex gap-2">
                  <button onClick={() => setStep("pix")} disabled={busy} className="flex-1 py-3 rounded-xl border border-[var(--border)]">Voltar</button>
                  <button onClick={submit} disabled={busy} className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold flex items-center justify-center gap-2">
                    {busy && <Loader2 size={16} className="animate-spin" />} Confirmar saque
                  </button>
                </div>
              </div>
            )}

            {step === "done" && result && (
              <div className="grid gap-4 mt-4 text-sm text-center">
                <CheckCircle2 size={44} className="text-green-500 mx-auto" />
                <p className="text-lg font-semibold">Saque solicitado</p>
                <p className="text-[var(--text-muted)]">{formatCurrency(result.amount)} para {PIX_LABEL[result.pixKeyType]} {result.pixKey}. Acompanhe o status na carteira; você recebe uma notificação quando o Pix for enviado.</p>
                <button onClick={onDone} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">Ver na carteira</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
