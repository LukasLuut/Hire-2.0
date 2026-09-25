import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { notificationAPI, timeAgo, type NotificationItem } from "../api/NotificationAPI";

const POLL_MS = 30_000;

/** Evento global para outras partes do app pedirem atualização (ex.: tempo real). */
export const NOTIFICATIONS_REFRESH = "hire:notifications-refresh";

/* --------------------------------------------------------------------------
 * NotificationBell — sino do menu com o número de avisos não lidos.
 * Abre uma lista curta; clicar num aviso marca como lido e leva à tela certa.
 * -------------------------------------------------------------------------- */
export default function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationAPI.list();
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      /* sem conexão: tenta de novo no próximo ciclo */
    }
  }, []);

  // atualiza ao trocar de página, periodicamente e quando alguém pede
  useEffect(() => {
    load();
  }, [load, location.pathname]);
  useEffect(() => {
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(NOTIFICATIONS_REFRESH, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_REFRESH, load);
    };
  }, [load]);

  // fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = async (n: NotificationItem) => {
    setOpen(false);
    onNavigate?.();
    if (!n.read) {
      try {
        const data = await notificationAPI.read(n.id);
        setUnread(data.unread);
        setItems(data.items);
      } catch {
        /* segue para a tela mesmo assim */
      }
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    try {
      const data = await notificationAPI.readAll();
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      /* nada a fazer */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Avisos: ${unread} ${unread === 1 ? "não lido" : "não lidos"}` : "Avisos"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative p-2 rounded-full border border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)] transition hover:border-[var(--highlight)] shadow-lg"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] shadow-2xl text-[var(--text)] z-50"
            role="dialog"
            aria-label="Avisos"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-semibold">Avisos</span>
              {unread > 0 && (
                <button onClick={readAll} className="text-xs text-[var(--primary)] hover:underline">Marcar todos como lidos</button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Nenhum aviso por enquanto.</p>
            ) : (
              <ul>
                {items.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button onClick={() => go(n)} className={`w-full text-left px-4 py-3 border-b border-[var(--border-muted)] hover:bg-[var(--bg)] flex gap-3 ${n.read ? "opacity-70" : ""}`}>
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-[var(--primary)]"}`} aria-hidden />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium">{n.title}</span>
                        {n.body && <span className="block text-xs text-[var(--text-muted)] line-clamp-2">{n.body}</span>}
                        <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">{timeAgo(n.createdAt)}{!n.read && <span className="sr-only"> · não lido</span>}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => { setOpen(false); onNavigate?.(); navigate("/pendencias"); }}
              className="w-full px-4 py-3 text-sm font-medium text-[var(--primary)] hover:bg-[var(--bg)] rounded-b-2xl"
            >
              Ver central de pendências
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
