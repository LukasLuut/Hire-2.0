import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BadgeCheck, Check, ChevronDown, CircleCheck, Handshake, History, Loader2, PencilLine, ScrollText, X } from "lucide-react";
import type { ConversationDetail, Negotiation, NegotiationTopic, Party } from "../../interfaces/Entities";
import { conversationAPI } from "../../api/ConversationAPI";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { DUR, EASE_OUT, ORIGIN_META, TONE_CLASS, TOPIC_META, dealTopics, firstName, negotiationStatus, partyName, progressOf } from "./chatUi";

/* --------------------------------------------------------------------------
 * Painel da negociação em foco, ao lado das mensagens.
 * Ordem do que aparece: o que falta (quem precisa agir) → tópicos → aceite final.
 * Sem negociação aberta o painel fica limpo: só o convite para negociar e o histórico.
 * -------------------------------------------------------------------------- */

type Props = {
  conv: ConversationDetail;
  focused: Negotiation | null;
  /** negociação que acabou de virar contrato nesta sessão (mostra o fechamento) */
  closedNow: Negotiation | null;
  onDismissClosed: () => void;
  onFocus: (id: number) => void;
  onNew: () => void;
  /** depois de qualquer ação: recarrega a conversa */
  onChanged: () => Promise<void> | void;
  token: string;
};

const field =
  "w-full px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border-muted)] text-[var(--text)] text-sm outline-none transition focus:border-[var(--primary)] placeholder:text-[var(--text-muted)]/70";

export default function NegotiationPanel({ conv, focused, closedNow, onDismissClosed, onFocus, onNew, onChanged, token }: Props) {
  const me = conv.myRole ?? "cliente";
  const other: Party = me === "cliente" ? "prestador" : "cliente";
  const otherName = partyName(conv, other);
  const open = conv.negotiations.filter((n) => n.status === "OPEN");
  const history = conv.negotiations.filter((n) => n.status !== "OPEN");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* várias negociações abertas: escolha qual ver */}
      {open.length > 1 && (
        <div className="px-4 pt-4 flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Negociações abertas">
          {open.map((n) => {
            const active = focused?.id === n.id;
            const waiting = n.waitingFor === me;
            return (
              <button
                key={n.id}
                role="tab"
                aria-selected={active}
                onClick={() => onFocus(n.id)}
                className={`relative shrink-0 max-w-[180px] truncate px-3 py-1.5 rounded-full text-xs border transition-colors duration-150
                  ${active ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)]"}`}
              >
                {waiting && !active && <span className="inline-block w-1.5 h-1.5 mr-1.5 mb-px rounded-full bg-[var(--deal-wait)]" aria-label="aguardando você" />}
                {n.title}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait" initial={false}>
          {closedNow ? (
            <DealClosed key={`done-${closedNow.id}`} n={closedNow} onDone={onDismissClosed} />
          ) : focused ? (
            <motion.div
              key={`n-${focused.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DUR.small, ease: EASE_OUT }}
            >
              <NegotiationView n={focused} conv={conv} me={me} otherName={otherName} onChanged={onChanged} token={token} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.small }}>
              <EmptyDeal me={me} otherName={otherName} onNew={onNew} />
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 0 && <HistoryList items={history} me={me} otherName={otherName} onFocus={onFocus} focusedId={focused?.id} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ negociação em foco */

function NegotiationView({ n, conv, me, otherName, onChanged, token }: { n: Negotiation; conv: ConversationDetail; me: Party; otherName: string; onChanged: Props["onChanged"]; token: string }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reason, setReason] = useState("");
  const origin = ORIGIN_META[n.origin];
  const status = negotiationStatus(n, me, otherName);
  const { agreed, total, ratio } = progressOf(n);
  const isOpen = n.status === "OPEN";
  const pendingRequest = isOpen && n.requestStatus === "PENDENTE";

  useEffect(() => {
    setEditing(null);
    setConfirmClose(false);
  }, [n.id]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) showToast(ok, "success");
      await onChanged();
      return true;
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível concluir."), "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveTopic = (t: NegotiationTopic, patch: Partial<NegotiationTopic>, note: string) =>
    run(`topic-${t.key}`, () => conversationAPI.updateTopics(conv.id, n.topics.map((x) => (x.key === t.key ? { ...x, ...patch } : x)), token, note, n.id));

  const iAccepted = !!(me === "cliente" ? n.clientAcceptedAt : n.providerAcceptedAt);
  const otherAccepted = !!(me === "cliente" ? n.providerAcceptedAt : n.clientAcceptedAt);
  const allAgreed = agreed === total && total > 0;
  const closeLabel = me === "cliente" && n.requestStatus === "RESPONDIDA" ? "Recusar proposta" : "Encerrar negociação";

  return (
    <div className="grid gap-4">
      {/* cabeçalho: origem, título e quem precisa agir */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <origin.icon size={14} aria-hidden /> {origin.label}
        </div>
        <h3 className="mt-1 text-base font-semibold leading-snug text-[var(--text)]">{n.title}</h3>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${TONE_CLASS[status.tone]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
            {status.text}
          </span>
          {isOpen && (
            <span className="text-xs text-[var(--text-muted)]">
              {agreed} de {total} tópicos acordados
            </span>
          )}
        </div>
        {isOpen && (
          <div className="mt-3 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={agreed} aria-label="Tópicos acordados">
            <motion.div
              className="h-full origin-left rounded-full bg-[var(--deal-ok)]"
              initial={false}
              animate={{ scaleX: ratio }}
              transition={{ duration: DUR.panel, ease: EASE_OUT }}
            />
          </div>
        )}
      </div>

      {/* pedido do cliente esperando a primeira resposta do prestador */}
      {pendingRequest && n.request && (
        <RequestCard n={n} me={me} conv={conv} otherName={otherName} busy={busy} run={run} token={token} />
      )}

      {/* tópicos */}
      <ul className="grid gap-2.5" aria-label="Tópicos da negociação">
        {dealTopics(n).map((t) => (
          <TopicCard
            key={t.key}
            t={t}
            me={me}
            otherName={otherName}
            disabled={!isOpen || pendingRequest}
            editing={editing === t.key}
            busy={busy === `topic-${t.key}`}
            onEdit={() => setEditing(t.key)}
            onCancel={() => setEditing(null)}
            onAgree={() => saveTopic(t, { state: "Acordado" }, `"${t.label}" aceito.`)}
            onPropose={async (content) => {
              if (await saveTopic(t, { content, state: "Pendente", proposedBy: me }, `Proposta em "${t.label}": ${content}`)) setEditing(null);
            }}
          />
        ))}
      </ul>

      {/* aceite final */}
      {isOpen && !pendingRequest && (
        <div className={`rounded-2xl border p-4 transition-colors duration-200 ${allAgreed ? "border-[color-mix(in_oklch,var(--deal-ok)_45%,transparent)] bg-[color-mix(in_oklch,var(--deal-ok)_8%,transparent)]" : "border-[var(--border-muted)] bg-[var(--bg)]"}`}>
          <div className="flex items-center gap-3">
            <AcceptDot label="Você" done={iAccepted} />
            <span className="h-px flex-1 bg-[var(--border-muted)]" aria-hidden />
            <AcceptDot label={firstName(otherName)} done={otherAccepted} />
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {!allAgreed
              ? "Quando todos os tópicos estiverem acordados, os dois aceitam e o contrato é gerado."
              : iAccepted
                ? `Seu aceite está registrado. Falta ${firstName(otherName)} aceitar.`
                : otherAccepted
                  ? `${firstName(otherName)} já aceitou. Seu aceite gera o contrato.`
                  : "Tudo acordado. Revise e aceite o acordo."}
          </p>
          <button
            type="button"
            disabled={!allAgreed || iAccepted || busy === "accept"}
            onClick={() =>
              run("accept", async () => {
                const r = await conversationAPI.accept(conv.id, token, n.id);
                if (!r.formalized) showToast(`Aceite registrado. Falta ${firstName(otherName)} aceitar.`, "success");
              })
            }
            className="mt-3 w-full h-11 rounded-xl bg-[var(--primary)] text-white font-medium flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            {busy === "accept" ? <Loader2 size={18} className="animate-spin" /> : <Handshake size={18} />}
            {iAccepted ? `Aguardando ${firstName(otherName)}` : otherAccepted ? "Aceitar e gerar contrato" : "Aceitar acordo"}
          </button>
        </div>
      )}

      {/* encerrar */}
      {isOpen && (
        <div>
          <AnimatePresence initial={false} mode="wait">
            {confirmClose ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DUR.small, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-[color-mix(in_oklch,var(--deal-no)_40%,transparent)] p-3 grid gap-2">
                  <label className="text-sm font-medium" htmlFor={`close-${n.id}`}>{closeLabel}?</label>
                  <textarea id={`close-${n.id}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional) — a outra parte verá" className={field} />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setConfirmClose(false)} className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
                    <button
                      type="button"
                      disabled={busy === "close"}
                      onClick={() => run("close", () => conversationAPI.close(conv.id, token, reason, n.id), "Negociação encerrada. A conversa continua aberta.")}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--deal-no)] hover:brightness-110 disabled:opacity-50"
                    >
                      {closeLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="ask"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmClose(true)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--deal-no)] transition-colors"
              >
                {closeLabel}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isOpen && (
        <p className="text-sm text-[var(--text-muted)]">
          {n.status === "FORMALIZED" ? (
            <>
              Acordo fechado.{" "}
              {n.contractId && (
                <Link to={`/contract/${n.contractId}`} className="text-[var(--primary)] hover:underline">
                  Ver contrato {n.contractCode}
                </Link>
              )}
            </>
          ) : (
            <>
              {n.requestStatus === "RECUSADA" ? "Pedido recusado" : "Negociação encerrada"}
              {n.closedBy ? ` por ${n.closedBy === me ? "você" : firstName(otherName)}` : ""}.
              {(n.rejectReason || n.closeReason) && <span className="block mt-1">Motivo: {n.rejectReason || n.closeReason}</span>}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function AcceptDot({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <motion.span
        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 ${done ? "bg-[var(--deal-ok)] border-[var(--deal-ok)] text-white" : "border-[var(--border)] text-transparent"}`}
        initial={false}
        animate={{ scale: done ? [1, 1.18, 1] : 1 }}
        transition={{ duration: DUR.panel, ease: EASE_OUT }}
        aria-hidden
      >
        <Check size={15} strokeWidth={3} />
      </motion.span>
      <span className="text-sm truncate">
        {label}
        <span className="sr-only">{done ? " aceitou" : " ainda não aceitou"}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ tópico */

function TopicCard({
  t,
  me,
  otherName,
  disabled,
  editing,
  busy,
  onEdit,
  onCancel,
  onAgree,
  onPropose,
}: {
  t: NegotiationTopic;
  me: Party;
  otherName: string;
  disabled: boolean;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onAgree: () => void;
  onPropose: (content: string) => void;
}) {
  const meta = TOPIC_META[t.key] ?? TOPIC_META.service;
  const [draft, setDraft] = useState(t.content);
  useEffect(() => {
    if (editing) setDraft(t.content);
  }, [editing, t.content]);

  const agreed = t.state === "Acordado";
  const hasContent = !!t.content?.trim();
  const theirs = hasContent && !!t.proposedBy && t.proposedBy !== me;
  const canAgree = !disabled && theirs && !agreed;
  const tone = agreed ? "ok" : canAgree ? "wait" : hasContent ? "mine" : "muted";
  const hint = agreed
    ? "Acordado"
    : !hasContent
      ? "A definir"
      : theirs
        ? `${firstName(otherName)} propôs`
        : "Você propôs";

  return (
    <motion.li layout="position" transition={{ duration: DUR.small, ease: EASE_OUT }} className={`rounded-2xl border bg-[var(--bg)] transition-colors duration-200 ${canAgree ? "border-[color-mix(in_oklch,var(--deal-wait)_45%,transparent)]" : "border-[var(--border-muted)]"}`}>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${agreed ? "bg-[color-mix(in_oklch,var(--deal-ok)_16%,transparent)] text-[var(--deal-ok)]" : "bg-[var(--bg-light)] text-[var(--text-muted)]"}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={agreed ? "ok" : "icon"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: DUR.micro }}>
                {agreed ? <CircleCheck size={17} /> : <meta.icon size={16} />}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="text-sm font-medium flex-1 min-w-0 truncate">{t.label}</span>
          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASS[tone]}`}>{hint}</span>
        </div>

        {!editing && (
          <p className={`mt-2 text-sm whitespace-pre-line break-words ${hasContent ? "text-[var(--text)]" : "text-[var(--text-muted)] italic"}`}>
            {hasContent ? t.content : "Ninguém propôs ainda."}
          </p>
        )}

        <AnimatePresence initial={false}>
          {editing && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DUR.small, ease: EASE_OUT }}
              className="overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim() && draft.trim() !== t.content.trim()) onPropose(draft.trim());
              }}
            >
              <div className="pt-2 grid gap-2">
                {meta.multiline ? (
                  <textarea autoFocus rows={3} maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={meta.placeholder} aria-label={t.label} className={field} />
                ) : (
                  <input autoFocus maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={meta.placeholder} aria-label={t.label} className={field} />
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Cancelar</button>
                  <button
                    type="submit"
                    disabled={busy || !draft.trim() || draft.trim() === t.content.trim()}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:brightness-110 disabled:opacity-45"
                  >
                    {busy ? "Enviando…" : "Enviar proposta"}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {!editing && !disabled && (
          <div className="mt-2.5 flex gap-2">
            {canAgree && (
              <button
                type="button"
                onClick={onAgree}
                disabled={busy}
                className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 text-white bg-[var(--deal-ok)] hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />} Aceitar
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)] transition"
            >
              <PencilLine size={14} /> {hasContent ? (theirs || agreed ? "Propor outra coisa" : "Alterar") : "Propor"}
            </button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ pedido do cliente */

function RequestCard({ n, me, conv, otherName, busy, run, token }: { n: Negotiation; me: Party; conv: ConversationDetail; otherName: string; busy: string | null; run: (k: string, fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; token: string }) {
  const [mode, setMode] = useState<"view" | "reply" | "reject">("view");
  const [form, setForm] = useState({ title: n.service?.title ?? "", description: "", price: "", deadline: "" });
  const [reason, setReason] = useState("");
  const r = n.request!;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="rounded-2xl border border-[color-mix(in_oklch,var(--primary)_40%,transparent)] bg-[color-mix(in_oklch,var(--primary)_7%,transparent)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ScrollText size={16} className="text-[var(--primary)]" /> {me === "prestador" ? `Pedido de ${firstName(otherName)}` : "Seu pedido"}
      </div>
      <p className="mt-2 text-sm whitespace-pre-line break-words">{r.description}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[var(--text-muted)]">Orçamento</dt>
          <dd className="font-medium">{r.budget || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Quando</dt>
          <dd className="font-medium">{r.date ? new Date(r.date.length === 10 ? r.date + "T00:00:00" : r.date).toLocaleDateString("pt-BR") : "A combinar"}</dd>
        </div>
      </dl>

      {me === "cliente" ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">{firstName(otherName)} vai responder com uma proposta. Você pode continuar conversando enquanto isso.</p>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          {mode === "view" && (
            <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex gap-2">
              <button type="button" onClick={() => setMode("reply")} className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:brightness-110 transition">
                Enviar proposta
              </button>
              <button type="button" onClick={() => setMode("reject")} className="h-10 px-3 rounded-xl border border-[var(--border-muted)] text-sm text-[var(--text-muted)] hover:text-[var(--deal-no)] hover:border-[var(--deal-no)] transition">
                Recusar
              </button>
            </motion.div>
          )}
          {mode === "reply" && (
            <motion.form
              key="reply"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DUR.small, ease: EASE_OUT }}
              className="overflow-hidden"
              onSubmit={async (e) => {
                e.preventDefault();
                await run("respond", () => conversationAPI.respond(conv.id, form, [], token, n.id), "Proposta enviada.");
              }}
            >
              <div className="mt-3 grid gap-2">
                <input value={form.title} onChange={set("title")} maxLength={100} placeholder="Título (opcional)" aria-label="Título da proposta" className={field} />
                <textarea required value={form.description} onChange={set("description")} rows={3} maxLength={400} placeholder="O que você vai fazer" aria-label="Descrição" className={field} />
                <div className="grid grid-cols-2 gap-2">
                  <input required value={form.price} onChange={set("price")} maxLength={100} placeholder="Valor (ex.: R$ 250)" aria-label="Valor" className={field} />
                  <input value={form.deadline} onChange={set("deadline")} maxLength={100} placeholder="Prazo (ex.: 2 dias)" aria-label="Prazo" className={field} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("view")} className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
                  <button type="submit" disabled={busy === "respond"} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:brightness-110 disabled:opacity-50">
                    {busy === "respond" ? "Enviando…" : "Enviar proposta"}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
          {mode === "reject" && (
            <motion.div key="reject" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DUR.small, ease: EASE_OUT }} className="overflow-hidden">
              <div className="mt-3 grid gap-2">
                <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional) — o cliente verá" aria-label="Motivo da recusa" className={field} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("view")} className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
                  <button
                    type="button"
                    disabled={busy === "reject"}
                    onClick={() => run("reject", () => conversationAPI.reject(conv.id, reason, token, n.id), "Pedido recusado.")}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--deal-no)] hover:brightness-110 disabled:opacity-50"
                  >
                    Recusar pedido
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ estados vazios e fechamento */

function EmptyDeal({ me, otherName, onNew }: { me: Party; otherName: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-6 pb-4">
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]">
        <Handshake size={26} />
      </span>
      <h3 className="mt-4 font-semibold">Nenhuma negociação aberta</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)] max-w-[260px]">
        {me === "prestador"
          ? `Converse à vontade. Quando entender o que ${firstName(otherName)} precisa, monte uma proposta sob medida ou use um serviço do seu catálogo.`
          : `Converse à vontade. Quando quiser fechar algo, peça um orçamento ou escolha um serviço de ${firstName(otherName)}.`}
      </p>
      <button type="button" onClick={onNew} className="mt-4 h-10 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-medium flex items-center gap-2 hover:brightness-110 active:scale-[0.98] transition">
        <Handshake size={17} /> Negociar
      </button>
    </div>
  );
}

function DealClosed({ n, onDone }: { n: Negotiation; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: DUR.panel, ease: EASE_OUT }}
      className="flex flex-col items-center text-center pt-6 pb-4"
      role="status"
    >
      <motion.span
        initial={{ scale: 0.4, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
        className="w-16 h-16 rounded-full flex items-center justify-center bg-[color-mix(in_oklch,var(--deal-ok)_18%,transparent)] text-[var(--deal-ok)]"
      >
        <BadgeCheck size={34} />
      </motion.span>
      <h3 className="mt-4 font-semibold text-lg">Acordo fechado</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)] max-w-[260px]">
        Contrato <strong className="text-[var(--text)]">{n.contractCode}</strong> gerado para “{n.title}”. Os campos da negociação foram limpos; a conversa continua.
      </p>
      <div className="mt-4 flex gap-2">
        {n.contractId && (
          <Link to={`/contract/${n.contractId}`} className="h-10 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-medium flex items-center gap-2 hover:brightness-110 transition">
            <ScrollText size={17} /> Ver contrato
          </Link>
        )}
        <button type="button" onClick={onDone} className="h-10 px-4 rounded-xl border border-[var(--border-muted)] text-sm hover:border-[var(--border)] transition">
          Voltar à conversa
        </button>
      </div>
    </motion.div>
  );
}

function HistoryList({ items, me, otherName, onFocus, focusedId }: { items: Negotiation[]; me: Party; otherName: string; onFocus: (id: number) => void; focusedId?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-[var(--border-muted)] pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        <History size={14} /> Histórico ({items.length})
        <motion.span className="ml-auto" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: DUR.small }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DUR.small, ease: EASE_OUT }} className="overflow-hidden">
            {items.map((n) => {
              const s = negotiationStatus(n, me, otherName);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onFocus(n.id)}
                    aria-current={focusedId === n.id ? "true" : undefined}
                    className={`mt-2 w-full text-left rounded-xl px-3 py-2 border transition-colors ${focusedId === n.id ? "border-[var(--primary)]" : "border-transparent hover:bg-[var(--bg)]"}`}
                  >
                    <span className="flex items-center gap-2">
                      {n.status === "FORMALIZED" ? <BadgeCheck size={14} className="text-[var(--deal-ok)] shrink-0" /> : <X size={14} className="text-[var(--deal-no)] shrink-0" />}
                      <span className="text-sm truncate flex-1">{n.title}</span>
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 pl-[22px]">
                      {s.text} · {new Date(n.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
