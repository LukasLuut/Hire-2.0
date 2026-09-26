import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Copy, CreditCard, Loader2, Lock, QrCode, Receipt, X } from "lucide-react";
import { hireAPI, type PaymentInstructions } from "../../api/HireAPI";
import type { HireEntity, PaymentMethod } from "../../interfaces/Entities";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { METHOD_LABEL } from "../../utils/payment";
import PaymentMethodPicker from "./PaymentMethodPicker";

type Step = "method" | "details" | "processing" | "done";

const field = "w-full p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--primary)]";
const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Bandeira pelo começo do número (só para exibir) */
function brandOf(number: string) {
  const d = onlyDigits(number);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return "Elo";
  if (/^(606282|3841)/.test(d)) return "Hipercard";
  return d.length >= 4 ? "Cartão" : "";
}

/** Dígito verificador do cartão (Luhn) */
function luhn(number: string) {
  const d = onlyDigits(number);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

function validExpiry(v: string) {
  const m = v.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const end = new Date(year, month, 1);
  return end.getTime() > Date.now();
}

/**
 * Checkout simulado: escolher a forma → preencher/pagar (Pix com QR Code e copia e cola,
 * cartão com validação e parcelas, boleto com linha digitável) → processando → comprovante.
 * Nenhum valor é cobrado; do cartão só a bandeira, o final e as parcelas vão ao servidor.
 */
export default function PaymentCheckout({ hire, open, onClose, onPaid }: { hire: HireEntity; open: boolean; onClose: () => void; onPaid: () => void }) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "", installments: 1 });
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState<HireEntity["payment"] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setStep("method");
    setMethod(null);
    setInstructions(null);
    setCard({ number: "", name: "", expiry: "", cvv: "", installments: 1 });
    setTouched(false);
    setReceipt(null);
  }, [open]);

  // contagem regressiva do Pix
  useEffect(() => {
    if (step !== "details" || method !== "pix") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, method]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && step !== "processing" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  const price = Number(hire.price);
  const title = hire.service?.title ?? hire.description_service;
  const cardErrors = useMemo(() => ({
    number: !luhn(card.number) ? "Número de cartão inválido" : "",
    name: card.name.trim().split(/\s+/).length < 2 ? "Nome como está no cartão" : "",
    expiry: !validExpiry(card.expiry) ? "Validade inválida (MM/AA)" : "",
    cvv: !/^\d{3,4}$/.test(card.cvv) ? "CVV inválido" : "",
  }), [card]);
  const cardOk = !Object.values(cardErrors).some(Boolean);

  const next = async () => {
    if (!method) return showToast("Escolha a forma de pagamento.", "warning");
    setStep("details");
    if (method !== "cartao") {
      setInstructions(null);
      try {
        setInstructions(await hireAPI.paymentInstructions(hire.id, method));
      } catch (e) {
        showToast(getErrorMessage(e, "Não foi possível gerar o pagamento."), "error");
        setStep("method");
      }
    }
  };

  const confirm = async () => {
    if (method === "cartao" && !cardOk) { setTouched(true); return; }
    setStep("processing");
    // tempo de "aprovação" para o usuário ver a etapa
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const details = method === "cartao"
        ? { last4: onlyDigits(card.number).slice(-4), brand: brandOf(card.number), installments: card.installments }
        : method === "boleto" && instructions && "barcode" in instructions ? { barcode: instructions.barcode } : undefined;
      const updated = await hireAPI.pay(hire.id, method!, details);
      setReceipt(updated?.payment ?? null);
      setStep("done");
      onPaid();
    } catch (e) {
      showToast(getErrorMessage(e, "Pagamento não aprovado."), "error");
      setStep("details");
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast("Copiado.", "success"); } catch { showToast("Não foi possível copiar.", "error"); }
  };

  const steps: [Step, string][] = [["method", "Forma"], ["details", "Pagamento"], ["done", "Comprovante"]];
  const stepIndex = step === "processing" ? 1 : steps.findIndex(([s]) => s === step);
  const pixLeft = instructions && "expiresAt" in instructions ? Math.max(0, new Date(instructions.expiresAt).getTime() - now) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => step !== "processing" && onClose()}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[var(--bg-light)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 text-[var(--text)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="checkout-title" className="text-xl font-semibold">Pagamento</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{title} · <strong className="text-[var(--text)]">{formatCurrency(price)}</strong></p>
              </div>
              {step !== "processing" && (
                <button onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={20} /></button>
              )}
            </div>

            {/* etapas */}
            <ol className="flex items-center gap-2 mt-4 mb-5 text-xs" aria-label="Etapas do pagamento">
              {steps.map(([id, label], i) => (
                <li key={id} className="flex items-center gap-2 flex-1" aria-current={i === stepIndex ? "step" : undefined}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${i < stepIndex || step === "done" ? "bg-[var(--primary)] border-[var(--primary)] text-white" : i === stepIndex ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{i + 1}</span>
                  <span className={i === stepIndex ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{label}</span>
                  {i < steps.length - 1 && <span className="flex-1 h-px bg-[var(--border)]" aria-hidden />}
                </li>
              ))}
            </ol>

            {step === "method" && (
              <div className="grid gap-4">
                <PaymentMethodPicker value={method} onChange={setMethod} />
                <p className="text-xs text-[var(--text-muted)] flex gap-2">
                  <Lock size={14} className="shrink-0 mt-0.5" aria-hidden />
                  O valor fica guardado pela Hire e só é repassado ao prestador quando você confirmar a conclusão. Cancelou? Você recebe de volta.
                </p>
                <button onClick={next} disabled={!method} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold disabled:opacity-50">Continuar</button>
              </div>
            )}

            {step === "details" && method === "pix" && (
              <div className="grid gap-3 text-sm">
                {!instructions ? <Loader2 className="animate-spin mx-auto" aria-label="Gerando Pix" /> : "code" in instructions && (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <img src={instructions.qr} alt="QR Code Pix para pagamento" className="w-48 h-48 rounded-xl bg-white p-2" />
                      <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
                        {pixLeft > 0 ? `Expira em ${Math.floor(pixLeft / 60000)}:${String(Math.floor((pixLeft % 60000) / 1000)).padStart(2, "0")}` : "Código expirado: volte e gere outro"}
                      </p>
                    </div>
                    <ol className="list-decimal pl-5 text-[var(--text-muted)] space-y-0.5">
                      <li>Abra o app do seu banco e escolha pagar com Pix.</li>
                      <li>Leia o QR Code ou cole o código abaixo.</li>
                      <li>Confira o valor ({formatCurrency(price)}) e confirme.</li>
                    </ol>
                    <div className="flex gap-2">
                      <input readOnly value={instructions.code} aria-label="Pix copia e cola" className={`${field} text-xs font-mono`} />
                      <button onClick={() => copy(instructions.code)} className="px-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] flex items-center gap-1"><Copy size={14} /> Copiar</button>
                    </div>
                    <button onClick={confirm} disabled={pixLeft <= 0} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold disabled:opacity-50">Já paguei</button>
                    <p className="text-xs text-center text-[var(--text-muted)]">Demonstração: nenhum valor é cobrado. "Já paguei" simula a confirmação do banco.</p>
                  </>
                )}
              </div>
            )}

            {step === "details" && method === "boleto" && (
              <div className="grid gap-3 text-sm">
                {!instructions ? <Loader2 className="animate-spin mx-auto" aria-label="Gerando boleto" /> : "barcode" in instructions && (
                  <>
                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Linha digitável · vence em {new Date(instructions.dueDate).toLocaleDateString("pt-BR")}</p>
                      <p className="font-mono text-sm break-all">{instructions.barcode}</p>
                      {/* código de barras ilustrativo */}
                      <div className="mt-3 h-12 flex items-stretch gap-[2px] bg-white p-1 rounded" aria-hidden>
                        {instructions.barcode.replace(/\D/g, "").split("").map((d, i) => <span key={i} className="bg-black" style={{ width: `${1 + (Number(d) % 3)}px`, marginRight: `${1 + ((Number(d) + i) % 2)}px` }} />)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => copy(instructions.barcode)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] flex items-center justify-center gap-2"><Copy size={14} /> Copiar linha digitável</button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Pague no app do banco, internet banking ou lotérica. A compensação leva até 3 dias úteis; o prestador vê o pedido como pago depois disso.</p>
                    <button onClick={confirm} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">Simular compensação do boleto</button>
                  </>
                )}
              </div>
            )}

            {step === "details" && method === "cartao" && (
              <form className="grid gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); confirm(); }} noValidate>
                <label className="grid gap-1">
                  <span className="text-[var(--text-muted)] flex justify-between">Número do cartão <span className="text-[var(--text)]">{brandOf(card.number)}</span></span>
                  <input className={field} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={card.number}
                    onChange={(e) => setCard({ ...card, number: onlyDigits(e.target.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ") })}
                    aria-invalid={touched && !!cardErrors.number} />
                  {touched && cardErrors.number && <span className="text-xs text-red-500">{cardErrors.number}</span>}
                </label>
                <label className="grid gap-1">
                  <span className="text-[var(--text-muted)]">Nome impresso no cartão</span>
                  <input className={field} autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })} aria-invalid={touched && !!cardErrors.name} />
                  {touched && cardErrors.name && <span className="text-xs text-red-500">{cardErrors.name}</span>}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[var(--text-muted)]">Validade</span>
                    <input className={field} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: onlyDigits(e.target.value).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2") })} aria-invalid={touched && !!cardErrors.expiry} />
                    {touched && cardErrors.expiry && <span className="text-xs text-red-500">{cardErrors.expiry}</span>}
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-muted)]">CVV</span>
                    <input className={field} inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: onlyDigits(e.target.value).slice(0, 4) })} aria-invalid={touched && !!cardErrors.cvv} />
                    {touched && cardErrors.cvv && <span className="text-xs text-red-500">{cardErrors.cvv}</span>}
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-[var(--text-muted)]">Parcelas</span>
                  <select className={field} value={card.installments} onChange={(e) => setCard({ ...card, installments: Number(e.target.value) })}>
                    {[1, 2, 3].map((n) => <option key={n} value={n}>{n}x de {formatCurrency(price / n)} sem juros</option>)}
                  </select>
                </label>
                <p className="text-xs text-[var(--text-muted)] flex gap-2"><Lock size={14} className="shrink-0 mt-0.5" aria-hidden /> Demonstração: use um número de teste (ex.: 4242 4242 4242 4242). Só a bandeira e os 4 últimos dígitos são guardados.</p>
                <button type="submit" className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">Pagar {formatCurrency(price)}</button>
              </form>
            )}

            {step === "details" && (
              <button onClick={() => setStep("method")} className="mt-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Trocar forma de pagamento</button>
            )}

            {step === "processing" && (
              <div className="py-10 flex flex-col items-center gap-3 text-center" aria-live="polite">
                <Loader2 size={36} className="animate-spin text-[var(--primary)]" />
                <p className="font-medium">{method === "cartao" ? "Aprovando com a operadora…" : method === "pix" ? "Confirmando o Pix…" : "Registrando a compensação…"}</p>
                <p className="text-xs text-[var(--text-muted)]">Não feche esta janela.</p>
              </div>
            )}

            {step === "done" && receipt && (
              <div className="grid gap-4 text-sm">
                <div className="flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 size={44} className="text-green-500" />
                  <p className="text-lg font-semibold">Pagamento aprovado</p>
                  <p className="text-[var(--text-muted)]">O valor fica guardado pela Hire até você confirmar a conclusão do serviço.</p>
                </div>
                <dl className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] grid grid-cols-2 gap-y-2">
                  <dt className="text-[var(--text-muted)]">Valor</dt><dd className="text-right font-semibold">{formatCurrency(receipt.amount)}</dd>
                  <dt className="text-[var(--text-muted)]">Forma</dt>
                  <dd className="text-right flex items-center justify-end gap-1">
                    {receipt.method === "pix" ? <QrCode size={14} /> : receipt.method === "cartao" ? <CreditCard size={14} /> : <Receipt size={14} />}
                    {receipt.method === "cartao" && receipt.details?.last4 ? `${receipt.details.brand} •••• ${receipt.details.last4}${(receipt.details.installments ?? 1) > 1 ? ` · ${receipt.details.installments}x` : ""}` : METHOD_LABEL[receipt.method]}
                  </dd>
                  <dt className="text-[var(--text-muted)]">Data</dt><dd className="text-right">{formatDateTime(receipt.paidAt)}</dd>
                  <dt className="text-[var(--text-muted)]">Transação</dt><dd className="text-right font-mono text-xs self-center">{receipt.transactionCode}</dd>
                </dl>
                <button onClick={onClose} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">Concluir</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
