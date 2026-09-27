import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChatDockContext } from "./chatDockContext";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import ChatInbox from "./ChatInbox";
import { conversationAPI } from "../../api/ConversationAPI";
import type { ConversationSummary } from "../../interfaces/Entities";
import { useSession } from "../../context/SessionContext";
import { useLiveEvent } from "../../utils/liveEvents";
import { avatarFor } from "../../utils/avatar";
import type { ChatClosed, ChatOpened, ChatOpenRequest } from "../../utils/chatEvents";

/* --------------------------------------------------------------------------
 * ChatDock — conversas minimizadas no canto direito da tela, empilhadas.
 * - Ao fechar uma conversa em que a pessoa escreveu, ela vira um círculo com a foto da outra parte.
 * - Resposta nova de outra conversa (em tempo real) também aparece como círculo, com bolinha vermelha.
 * - Os círculos acompanham a navegação e ficam guardados por conta (neste navegador).
 * - Também é quem abre a caixa de conversas pelo ícone de Chat da navbar.
 * -------------------------------------------------------------------------- */
type DockItem = { conversationId: number; name: string; avatar: string; unread: boolean };


const MAX_ITEMS = 6;
const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento: só nesta aba */ }
};

/** Nome e foto da outra parte da conversa */
function counterpart(c: ConversationSummary) {
  if (c.myRole === "cliente") {
    const name = c.provider?.companyName || c.provider?.professionalName || "Prestador";
    return { name, avatar: avatarFor(c.provider?.profileImageUrl ?? null, name) };
  }
  const name = c.client?.name || "Cliente";
  return { name, avatar: avatarFor(c.client?.avatarUrl ?? null, name) };
}

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { token, user } = useSession();
  const storeKey = user ? `hire.chatDock.${user.id}` : null;
  const seenKey = user ? `hire.chatSeen.${user.id}` : null;
  const [items, setItems] = useState<DockItem[]>([]);
  const [inbox, setInbox] = useState<{ open: boolean; conversationId: number | null; draft?: string }>({ open: false, conversationId: null });
  const openIds = useRef(new Set<number>());

  // carrega a pilha da conta que entrou (e limpa ao sair)
  useEffect(() => {
    setItems(storeKey ? read<DockItem[]>(storeKey, []) : []);
  }, [storeKey]);
  useEffect(() => {
    if (storeKey) write(storeKey, items);
  }, [items, storeKey]);

  const markSeen = useCallback((id: number) => {
    if (!seenKey) return;
    const seen = read<Record<string, string>>(seenKey, {});
    seen[id] = new Date().toISOString();
    write(seenKey, seen);
  }, [seenKey]);

  const upsert = useCallback((item: DockItem) => {
    setItems((list) => [item, ...list.filter((i) => i.conversationId !== item.conversationId)].slice(0, MAX_ITEMS));
  }, []);

  const summaryOf = useCallback(async (id: number) => {
    if (!token) return null;
    const list = await conversationAPI.list(token).catch(() => [] as ConversationSummary[]);
    return list.find((c) => c.id === id) ?? null;
  }, [token]);

  // a sala abriu: marca como vista e tira a bolinha vermelha
  useEffect(() => {
    const onOpened = (e: Event) => {
      const { conversationId } = (e as CustomEvent<ChatOpened>).detail;
      openIds.current.add(conversationId);
      markSeen(conversationId);
      setItems((list) => list.map((i) => (i.conversationId === conversationId ? { ...i, unread: false } : i)));
    };
    // a sala fechou: se a pessoa escreveu, a conversa fica minimizada na pilha
    const onClosed = async (e: Event) => {
      const { conversationId, sent } = (e as CustomEvent<ChatClosed>).detail;
      openIds.current.delete(conversationId);
      markSeen(conversationId);
      const inDock = items.some((i) => i.conversationId === conversationId);
      if (!sent && !inDock) return;
      const c = await summaryOf(conversationId);
      if (c) upsert({ conversationId, ...counterpart(c), unread: false });
    };
    const onRequest = (e: Event) => {
      const { conversationId, draft } = (e as CustomEvent<ChatOpenRequest>).detail;
      setInbox({ open: true, conversationId, draft });
    };
    window.addEventListener("hire:chat-opened", onOpened);
    window.addEventListener("hire:chat-closed", onClosed);
    window.addEventListener("hire:chat-open", onRequest);
    return () => {
      window.removeEventListener("hire:chat-opened", onOpened);
      window.removeEventListener("hire:chat-closed", onClosed);
      window.removeEventListener("hire:chat-open", onRequest);
    };
  }, [items, markSeen, summaryOf, upsert]);

  // mensagem nova de outra pessoa numa conversa que não está aberta: aparece o círculo com a bolinha vermelha
  useLiveEvent(async (e) => {
    if (e.type !== "conversation" || !token || openIds.current.has(e.id)) return;
    const c = await summaryOf(e.id);
    const last = c?.lastMessage;
    if (!c || !last || last.role === c.myRole) return;
    const seen = seenKey ? read<Record<string, string>>(seenKey, {})[c.id] : undefined;
    if (seen && new Date(last.createdAt) <= new Date(seen)) return;
    upsert({ conversationId: c.id, ...counterpart(c), unread: true });
  });

  const unreadCount = items.filter((i) => i.unread).length;
  const openInbox = useCallback(() => setInbox({ open: true, conversationId: null }), []);

  return (
    <ChatDockContext.Provider value={{ unreadCount, openInbox }}>
      {children}
      {token && (
        <>
          <ul className="fixed right-4 sm:right-6 bottom-24 sm:bottom-6 z-40 flex flex-col gap-3" aria-label="Conversas minimizadas">
            <AnimatePresence>
              {items.map((item) => (
                <motion.li
                  key={item.conversationId}
                  layout
                  initial={{ opacity: 0, scale: 0.6, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.6, x: 20 }}
                  className="relative group"
                >
                  <button
                    type="button"
                    onClick={() => setInbox({ open: true, conversationId: item.conversationId })}
                    aria-label={`Abrir conversa com ${item.name}${item.unread ? " (mensagem nova)" : ""}`}
                    className="block w-14 h-14 rounded-full border-4 border-[var(--primary)] bg-[var(--bg)] shadow-[0_6px_20px_rgba(0,0,0,0.45)] overflow-hidden hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <img src={item.avatar} alt="" className="w-full h-full object-cover" />
                  </button>
                  {item.unread && <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 ring-2 ring-[var(--bg-dark)]" aria-hidden />}
                  {/* nome ao passar o mouse: surge acima do círculo */}
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full right-0 mb-2 z-10 whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium shadow-lg
                               opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
                  >
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems((list) => list.filter((i) => i.conversationId !== item.conversationId))}
                    aria-label={`Tirar ${item.name} da pilha`}
                    className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[var(--bg-light)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <X size={12} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <ChatInbox
            isOpen={inbox.open}
            initialConversationId={inbox.conversationId}
            initialDraft={inbox.draft}
            onClose={() => setInbox({ open: false, conversationId: null })}
          />
        </>
      )}
    </ChatDockContext.Provider>
  );
}
