import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, Bell, ArrowRight } from "lucide-react";
import { notificationAPI, timeAgo, type NotificationItem, type PendingItem } from "../api/NotificationAPI";
import { NOTIFICATIONS_REFRESH } from "../components/NotificationBell";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast/ToastContext";

/* --------------------------------------------------------------------------
 * /pendencias — central de pendências.
 * "O que depende de você" é calculado na hora (pedidos a iniciar, entregas a
 * confirmar, propostas a responder, contratos a assinar, avaliações...);
 * abaixo, o histórico de avisos.
 * -------------------------------------------------------------------------- */
export default function PendingPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [notices, setNotices] = useState<NotificationItem[]>([]);
  const [error, setError] = useState(false);
  const { user, refresh } = useSession();
  const { showToast } = useToast();
  const [savingPref, setSavingPref] = useState(false);

  const toggleEmail = async (on: boolean) => {
    setSavingPref(true);
    try {
      await notificationAPI.setEmailPreference(on);
      await refresh();
      showToast(on ? "Você vai receber os avisos também por e-mail." : "Avisos por e-mail desligados.", "success");
    } catch {
      showToast("Não foi possível salvar a preferência.", "error");
    } finally {
      setSavingPref(false);
    }
  };

  const load = useCallback(async () => {
    setError(false);
    try {
      const [p, n] = await Promise.all([notificationAPI.pending(), notificationAPI.list()]);
      setPending(p);
      setNotices(n.items);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNotice = async (n: NotificationItem) => {
    if (!n.read) {
      await notificationAPI.read(n.id).catch(() => null);
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH));
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    const data = await notificationAPI.readAll().catch(() => null);
    if (data) setNotices(data.items);
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <ClipboardCheck className="text-[var(--primary)]" /> Central de pendências
        </h1>
        <p className="text-[var(--text-muted)] mb-4">O que precisa de você agora, como cliente e como prestador.</p>

        {/* Preferência: avisos também por e-mail */}
        {user && (
          <label className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 accent-[var(--primary)]"
              checked={user.emailNotifications !== false}
              disabled={savingPref}
              onChange={(e) => toggleEmail(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Receber estes avisos também por e-mail</span>
              <span className="block text-[var(--text-muted)]">
                {user.emailVerified === false
                  ? `Confirme seu e-mail (${user.email}) para começar a receber.`
                  : `Enviamos para ${user.email}.`}
              </span>
            </span>
          </label>
        )}

        {error ? (
          <p className="text-[var(--text-muted)]">
            Não foi possível carregar.{" "}
            <button onClick={load} className="text-[var(--primary)] underline">Tentar novamente</button>
          </p>
        ) : pending === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-light)] animate-pulse" />)}
          </div>
        ) : pending.length === 0 ? (
          <p className="p-6 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] text-center text-[var(--text-muted)]">
            Tudo em dia. Nada esperando por você.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="O que depende de você">
            {pending.map((p, i) => (
              <motion.li key={`${p.kind}-${p.link}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button
                  onClick={() => navigate(p.link)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] hover:border-[var(--primary)] text-left transition"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-sm text-[var(--text-muted)] truncate">{p.description}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm text-[var(--primary)] shrink-0">Resolver <ArrowRight size={16} /></span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between mt-12 mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Bell size={18} /> Avisos recentes</h2>
          {notices.some((n) => !n.read) && (
            <button onClick={readAll} className="text-sm text-[var(--primary)] hover:underline">Marcar todos como lidos</button>
          )}
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum aviso ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-muted)] rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] overflow-hidden">
            {notices.map((n) => (
              <li key={n.id}>
                <button onClick={() => openNotice(n)} className={`w-full text-left px-4 py-3 hover:bg-[var(--bg)] flex gap-3 ${n.read ? "opacity-70" : ""}`}>
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-[var(--primary)]"}`} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{n.title}{!n.read && <span className="sr-only"> (não lido)</span>}</span>
                    {n.body && <span className="block text-xs text-[var(--text-muted)]">{n.body}</span>}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
