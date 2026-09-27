import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Loader2, MessageSquareQuote, PencilRuler, Store, X } from "lucide-react";
import type { ConversationSummary, ServiceEntity } from "../../interfaces/Entities";
import { conversationAPI, type NegotiationResult } from "../../api/ConversationAPI";
import { providerApi } from "../../api/ProviderAPI";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { displayServicePrice } from "../../utils/price";
import { DUR, EASE_OUT, firstName, partyName } from "./chatUi";

/* --------------------------------------------------------------------------
 * "Negociar" dentro da conversa. Três caminhos, conforme quem está falando:
 * - serviço do catálogo (os dois lados);
 * - proposta sob medida (prestador) — opcional, nasce do que o cliente pediu;
 * - pedido de orçamento (cliente) — descreve o que precisa, com o orçamento.
 * Abre como uma folha por cima da sala; Esc ou "voltar" fecham sem perder a conversa.
 * -------------------------------------------------------------------------- */

type Step = "menu" | "catalog" | "custom" | "proposal";

const field =
  "w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border-muted)] text-[var(--text)] text-sm outline-none transition focus:border-[var(--primary)] placeholder:text-[var(--text-muted)]/70";

export default function NewNegotiation({ conv, token, onClose, onCreated }: { conv: ConversationSummary; token: string; onClose: () => void; onCreated: (r: NegotiationResult) => void }) {
  const { showToast } = useToast();
  const me = conv.myRole ?? "cliente";
  const otherName = partyName(conv, me === "cliente" ? "prestador" : "cliente");
  const [step, setStep] = useState<Step>("menu");
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<ServiceEntity[] | null>(null);
  const [custom, setCustom] = useState({ title: "", description: "", price: "", duration: "", start: "", saveToCatalog: false });
  const [proposal, setProposal] = useState({ description: "", budget: "", date: "" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (step === "menu") onClose();
      else setStep("menu");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, onClose]);

  useEffect(() => {
    if (step !== "catalog" || services || !conv.provider) return;
    providerApi
      .getPublic(conv.provider.id)
      .then((p) => setServices((p?.services ?? []).filter((s) => s.active !== false)))
      .catch(() => setServices([]));
  }, [step, services, conv.provider]);

  const create = async (data: Parameters<typeof conversationAPI.createNegotiation>[1], ok: string) => {
    setBusy(true);
    try {
      const r = await conversationAPI.createNegotiation(conv.id, data, token);
      showToast(ok, "success");
      onCreated(r);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a negociação."), "error");
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { step: "catalog" as const, icon: Store, title: "Serviço do catálogo", text: me === "prestador" ? "Use um serviço que você já oferece e ajuste os detalhes." : `Escolha um serviço de ${firstName(otherName)} e ajuste os detalhes.` },
    me === "prestador"
      ? { step: "custom" as const, icon: PencilRuler, title: "Proposta sob medida", text: `Monte uma proposta para o que ${firstName(otherName)} precisa. Pode virar serviço do seu catálogo.` }
      : { step: "proposal" as const, icon: MessageSquareQuote, title: "Pedir orçamento", text: `Descreva o que você precisa e quanto pretende pagar. ${firstName(otherName)} responde quando puder.` },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.small }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-negotiation-title"
        className="w-full sm:w-[440px] max-h-[88%] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--bg-light)] border border-[var(--border)] shadow-2xl"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: DUR.panel, ease: EASE_OUT }}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 px-5 pt-5 pb-3 bg-[var(--bg-light)]">
          {step !== "menu" && (
            <button type="button" onClick={() => setStep("menu")} aria-label="Voltar" className="p-1.5 -ml-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 id="new-negotiation-title" className="text-lg font-semibold flex-1">
            {step === "menu" ? "Negociar" : step === "catalog" ? "Serviço do catálogo" : step === "custom" ? "Proposta sob medida" : "Pedir orçamento"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: step === "menu" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: step === "menu" ? 12 : -12 }} transition={{ duration: DUR.small, ease: EASE_OUT }}>
              {step === "menu" && (
                <div className="grid gap-3">
                  <p className="text-sm text-[var(--text-muted)]">Cada negociação fica registrada nesta conversa. Depois do contrato, a conversa continua.</p>
                  {options.map((o) => (
                    <button
                      key={o.step}
                      type="button"
                      onClick={() => setStep(o.step)}
                      className="group flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] text-left transition hover:border-[var(--primary)] active:scale-[0.99]"
                    >
                      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]">
                        <o.icon size={21} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium">{o.title}</span>
                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">{o.text}</span>
                      </span>
                      <ChevronRight size={18} className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}

              {step === "catalog" && (
                <div className="grid gap-2">
                  {services === null ? (
                    [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-[var(--bg)] animate-pulse" />)
                  ) : services.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                      {me === "prestador" ? "Você ainda não tem serviços ativos. Use a proposta sob medida." : `${firstName(otherName)} não tem serviços ativos agora. Peça um orçamento.`}
                    </p>
                  ) : (
                    services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={busy}
                        onClick={() => create({ serviceId: s.id }, `Negociação aberta: ${s.title}`)}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] text-left transition hover:border-[var(--primary)] disabled:opacity-60"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{s.title}</span>
                          <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                            {displayServicePrice(s as never)} · {s.duration}
                          </span>
                        </span>
                        {busy ? <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /> : <ChevronRight size={16} className="text-[var(--text-muted)]" />}
                      </button>
                    ))
                  )}
                </div>
              )}

              {step === "custom" && (
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create({ custom: custom }, "Proposta enviada.");
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    Título
                    <input required maxLength={100} value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="Ex.: Instalação de 2 luminárias" className={field} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    O que está incluso
                    <textarea required rows={3} maxLength={400} value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} placeholder="Descreva o serviço, materiais e o que não está incluso" className={field} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm">
                      Valor
                      <input required maxLength={100} value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} placeholder="R$ 250,00 · Pix" className={field} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Duração
                      <input maxLength={100} value={custom.duration} onChange={(e) => setCustom({ ...custom, duration: e.target.value })} placeholder="3 horas" className={field} />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm">
                    Início sugerido <span className="text-xs text-[var(--text-muted)] -mt-1">opcional</span>
                    <input maxLength={100} value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} placeholder="Ex.: Sábado às 9:00" className={field} />
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-muted)] cursor-pointer">
                    <input type="checkbox" checked={custom.saveToCatalog} onChange={(e) => setCustom({ ...custom, saveToCatalog: e.target.checked })} className="mt-0.5 accent-[var(--primary)]" />
                    <span className="text-sm">
                      Salvar também no meu catálogo
                      <span className="block text-xs text-[var(--text-muted)]">Vira um serviço publicado, que outros clientes podem contratar.</span>
                    </span>
                  </label>
                  <SubmitButton busy={busy} label={`Enviar para ${firstName(otherName)}`} />
                </form>
              )}

              {step === "proposal" && (
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create({ proposal }, "Pedido enviado.");
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    O que você precisa
                    <textarea required rows={4} maxLength={500} value={proposal.description} onChange={(e) => setProposal({ ...proposal, description: e.target.value })} placeholder="Conte os detalhes: o que, onde, tamanho, materiais…" className={field} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm">
                      Orçamento
                      <input required maxLength={100} value={proposal.budget} onChange={(e) => setProposal({ ...proposal, budget: e.target.value })} placeholder="R$ 200" className={field} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Para quando
                      <input type="date" value={proposal.date} onChange={(e) => setProposal({ ...proposal, date: e.target.value })} className={field} />
                    </label>
                  </div>
                  <SubmitButton busy={busy} label={`Enviar para ${firstName(otherName)}`} />
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button type="submit" disabled={busy} className="mt-1 h-11 rounded-xl bg-[var(--primary)] text-white font-medium flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50">
      {busy && <Loader2 size={17} className="animate-spin" />} {label}
    </button>
  );
}
