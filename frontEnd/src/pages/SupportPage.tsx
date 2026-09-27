import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, Loader2 } from "lucide-react";
import { supportAPI, SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, type SupportCategory, type SupportTicket } from "../api/SupportAPI";
import { useToast } from "../components/Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const field = "w-full p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

/* --------------------------------------------------------------------------
 * /ajuda — central de suporte: abrir chamado e acompanhar as respostas.
 * Problema com um pedido específico continua em "Relatar problema" no pedido.
 * -------------------------------------------------------------------------- */
export default function SupportPage() {
  const { showToast } = useToast();
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<SupportTicket[] | null>(null);

  const load = useCallback(() => {
    supportAPI.mine().then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return showToast("Escolha o assunto.", "warning");
    setSending(true);
    try {
      await supportAPI.create({ category, subject: subject.trim(), message: message.trim() });
      showToast("Chamado aberto. Você recebe uma notificação quando respondermos.", "success");
      setCategory("");
      setSubject("");
      setMessage("");
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir o chamado."), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <LifeBuoy className="text-[var(--primary)]" /> Ajuda
        </h1>
        <p className="text-[var(--text-muted)] mb-6">
          Dúvidas, problemas técnicos ou sugestões. Problema com um pedido específico? Use <strong>Relatar problema</strong> no próprio pedido em{" "}
          <Link to="/hires" className="underline text-[var(--primary)]">Contratações</Link>.
        </p>

        <form onSubmit={submit} className="grid gap-3 p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] mb-8">
          <h2 className="font-semibold">Abrir chamado</h2>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Assunto</span>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} required>
              <option value="" disabled>Escolha…</option>
              {Object.entries(SUPPORT_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Título</span>
            <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} minLength={3} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Conte o que aconteceu</span>
            <textarea className={`${field} resize-y`} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} minLength={10} required />
          </label>
          <button type="submit" disabled={sending} className="justify-self-start px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white font-medium disabled:opacity-60 flex items-center gap-2">
            {sending && <Loader2 size={16} className="animate-spin" />} Enviar
          </button>
        </form>

        <h2 className="font-semibold mb-3">Meus chamados</h2>
        {!list ? (
          <Loader2 className="animate-spin" aria-label="Carregando" />
        ) : list.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Você ainda não abriu nenhum chamado.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((t) => (
              <li key={t.id} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{t.subject}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${t.status === "RESOLVIDO" ? "border-green-500/50 text-green-500" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                    {SUPPORT_STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">#{t.id} · {SUPPORT_CATEGORY_LABEL[t.category]} · {formatDateTime(t.createdAt)}</span>
                </div>
                <p className="text-sm mt-2 whitespace-pre-line text-[var(--text-muted)]">{t.message}</p>
                {t.reply && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--bg)] border-l-2 border-[var(--primary)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Resposta da equipe Hire{t.answeredAt ? ` · ${formatDateTime(t.answeredAt)}` : ""}</p>
                    <p className="text-sm whitespace-pre-line">{t.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
