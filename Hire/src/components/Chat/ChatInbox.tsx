import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { conversationAPI } from "../../api/ConversationAPI";
import type { ConversationSummary } from "../../interfaces/Entities";
import ServiceFormalizerModal from "../Negotiation/ServiceFormalizerModal";
import { avatarFor } from "../../utils/avatar";

const STATUS_LABEL: Record<ConversationSummary["status"], string> = {
  OPEN: "Em negociação",
  FORMALIZED: "Formalizada",
  CLOSED: "Encerrada",
};

/* --------------------------------------------------------------------------
 * ChatInbox — conversas/negociações do usuário (como cliente ou prestador).
 * Ao escolher uma, abre a sala de negociação (ServiceFormalizerModal).
 * Com initialConversationId, abre direto essa conversa.
 * -------------------------------------------------------------------------- */
interface ChatInboxProps {
  isOpen: boolean;
  onClose: () => void;
  initialConversationId?: number | null;
}

export default function ChatInbox({ isOpen, onClose, initialConversationId = null }: ChatInboxProps) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setError(false);
    try {
      setItems(await conversationAPI.list(token));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveId(initialConversationId);
    load();
  }, [isOpen, initialConversationId, load]);

  useEffect(() => {
    if (!isOpen || activeId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, activeId, onClose]);

  if (!isOpen) return null;

  // Conversa aberta: mostra a sala de negociação; ao fechar volta para a lista
  if (activeId) {
    return (
      <ServiceFormalizerModal
        conversationId={activeId}
        isOpen
        onClose={() => {
          if (initialConversationId) onClose();
          else {
            setActiveId(null);
            load();
          }
        }}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inbox-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 250, damping: 22 }}
          className="w-full max-w-lg max-h-[80vh] flex flex-col bg-[var(--bg-light)] rounded-2xl shadow-2xl border border-[var(--border)] text-[var(--text)]"
        >
          <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
            <h2 id="inbox-title" className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare size={20} className="text-[var(--primary)]" /> Mensagens
            </h2>
            <button onClick={onClose} aria-label="Fechar" className="text-[var(--text-muted)] hover:text-[var(--primary)]">
              <X size={22} />
            </button>
          </div>

          <div className="overflow-y-auto p-3 flex flex-col gap-2">
            {error ? (
              <p className="p-4 text-[var(--text-muted)]">
                Não foi possível carregar suas conversas.{" "}
                <button onClick={load} className="text-[var(--primary)] underline">Tentar novamente</button>
              </p>
            ) : items === null ? (
              [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-[var(--bg)] animate-pulse" />)
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-[var(--text-muted)]">
                Nenhuma conversa ainda. Abra um serviço e toque em <strong>Mensagem</strong> para negociar com o prestador.
              </p>
            ) : (
              items.map((c) => {
                const isClient = c.myRole === "cliente";
                const name = isClient ? c.provider?.companyName || c.provider?.professionalName : c.client?.name;
                const photo = isClient ? avatarFor(c.provider?.profileImageUrl, c.provider?.companyName) : avatarFor(null, c.client?.name);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border-muted)] hover:border-[var(--highlight)] transition text-left"
                  >
                    <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover border border-[var(--border)]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{name ?? "Contato"}</span>
                        <span className="text-xs text-[var(--text-muted)] shrink-0">{STATUS_LABEL[c.status]}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{c.service?.title ?? "Conversa geral"}</div>
                      {c.lastMessage && <div className="text-sm text-[var(--text-muted)] truncate mt-0.5">{c.lastMessage.text}</div>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
