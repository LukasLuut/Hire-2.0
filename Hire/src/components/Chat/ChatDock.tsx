import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { ChatDockContext } from "./chatDockContext";
import ServiceFormalizerModal from "../Negotiation/ServiceFormalizerModal";
import { conversationAPI } from "../../api/ConversationAPI";
import type { ConversationSummary } from "../../interfaces/Entities";
import { useSession } from "../../context/SessionContext";
import { useLiveEvent } from "../../utils/liveEvents";
import { avatarFor } from "../../utils/avatar";
import { conversationStatus } from "../../utils/conversation";
import type { ChatClosed, ChatOpened, ChatOpenRequest } from "../../utils/chatEvents";

/* --------------------------------------------------------------------------
 * ChatDock — conversas em andamento e conversas minimizadas.
 * - Painel "Conversas" (ícone da navbar): fica aberto; escolher uma conversa abre o chat ao lado
 *   e minimiza a que estava aberta. Fecha só quando a pessoa quiser.
 * - Conversas minimizadas: círculos com a foto da outra parte, empilhados no canto direito.
 *   Quantos cabem depende da altura da tela; o excedente vira um círculo "+N" que abre a lista.
 * - Resposta nova (tempo real) numa conversa fechada aparece como círculo com bolinha vermelha.
 * - A pilha vale para a sessão: some ao sair da conta ou fechar o navegador; as conversas
 *   continuam no painel "Conversas".
 * -------------------------------------------------------------------------- */
type DockItem = { conversationId: number; name: string; avatar: string; unread: boolean };

// círculo 56px + espaço 12px; reserva para a navbar, o respiro do topo e o canto de baixo
const SLOT = 68;
const RESERVED_DESKTOP = 72 + 24 + 24 + 40;
const RESERVED_MOBILE = 72 + 24 + 96 + 40;

const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(sessionStorage.getItem(key) ?? "") as T; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento: só na memória */ }
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

/** Quantos círculos cabem na coluna, pela altura da janela */
function useDockCapacity() {
  const calc = () => {
    const mobile = window.innerWidth < 640;
    return Math.max(2, Math.floor((window.innerHeight - (mobile ? RESERVED_MOBILE : RESERVED_DESKTOP)) / SLOT));
  };
  const [cap, setCap] = useState(calc);
  useEffect(() => {
    const onResize = () => setCap(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cap;
}

function Circle({ item, onOpen, onDismiss }: { item: DockItem; onOpen: () => void; onDismiss: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir conversa com ${item.name}${item.unread ? " (mensagem nova)" : ""}`}
        className="block w-14 h-14 rounded-full border-4 border-[var(--primary)] bg-[var(--bg)] shadow-[0_6px_20px_rgba(0,0,0,0.45)] overflow-hidden hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <img src={item.avatar} alt="" className="w-full h-full object-cover" />
      </button>
      {item.unread && <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 ring-2 ring-[var(--bg-dark)]" aria-hidden />}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 mb-2 z-10 whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium shadow-lg
                   opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
      >
        {item.name}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Tirar ${item.name} da pilha`}
        className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[var(--bg-light)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <X size={12} />
      </button>
    </>
  );
}

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { token, user } = useSession();
  const storeKey = user ? `hire.chatDock.${user.id}` : null;
  const seenKey = user ? `hire.chatSeen.${user.id}` : null;
  const [items, setItems] = useState<DockItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [active, setActive] = useState<{ id: number; draft?: string } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const openIds = useRef(new Set<number>());
  const lastKey = useRef<string | null>(null);
  const capacity = useDockCapacity();

  // pilha da sessão: carrega ao entrar; ao sair da conta, apaga
  useEffect(() => {
    if (!storeKey && lastKey.current) {
      try { sessionStorage.removeItem(lastKey.current); } catch { /* ignora */ }
    }
    lastKey.current = storeKey;
    setItems(storeKey ? read<DockItem[]>(storeKey, []) : []);
    setActive(null);
    setPanelOpen(false);
  }, [storeKey]);
  useEffect(() => {
    if (storeKey) write(storeKey, items);
  }, [items, storeKey]);

  const markSeen = useCallback((id: number) => {
    if (!seenKey) return;
    try {
      const seen = JSON.parse(localStorage.getItem(seenKey) ?? "{}") as Record<string, string>;
      seen[id] = new Date().toISOString();
      localStorage.setItem(seenKey, JSON.stringify(seen));
    } catch { /* ignora */ }
  }, [seenKey]);

  const upsert = useCallback((item: DockItem) => {
    setItems((list) => [item, ...list.filter((i) => i.conversationId !== item.conversationId)].slice(0, 60));
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) return [] as ConversationSummary[];
    const list = await conversationAPI.list(token).catch(() => [] as ConversationSummary[]);
    setConversations(list);
    return list;
  }, [token]);

  const summaryOf = useCallback(async (id: number) => (await loadConversations()).find((c) => c.id === id) ?? null, [loadConversations]);

  /** Abre uma conversa; a que estava aberta vai para a pilha */
  const openChat = useCallback(async (id: number, draft?: string) => {
    setOverflowOpen(false);
    if (active && active.id !== id) {
      const current = (conversations ?? []).find((c) => c.id === active.id) ?? (await summaryOf(active.id));
      if (current) upsert({ conversationId: current.id, ...counterpart(current), unread: false });
    }
    setItems((list) => list.map((i) => (i.conversationId === id ? { ...i, unread: false } : i)));
    setActive({ id, draft });
  }, [active, conversations, summaryOf, upsert]);

  useEffect(() => {
    const onOpened = (e: Event) => {
      const { conversationId } = (e as CustomEvent<ChatOpened>).detail;
      openIds.current.add(conversationId);
      markSeen(conversationId);
      setItems((list) => list.map((i) => (i.conversationId === conversationId ? { ...i, unread: false } : i)));
    };
    // uma sala fechou: se a pessoa escreveu (ou já estava na pilha), a conversa fica minimizada
    const onClosed = async (e: Event) => {
      const { conversationId, sent } = (e as CustomEvent<ChatClosed>).detail;
      openIds.current.delete(conversationId);
      markSeen(conversationId);
      if (!sent && !items.some((i) => i.conversationId === conversationId)) return;
      const c = await summaryOf(conversationId);
      if (c) upsert({ conversationId, ...counterpart(c), unread: false });
    };
    // outras telas pedem para abrir uma conversa (ou a lista)
    const onRequest = (e: Event) => {
      const { conversationId, draft } = (e as CustomEvent<ChatOpenRequest>).detail;
      if (conversationId) openChat(conversationId, draft);
      else { setPanelOpen(true); loadConversations(); }
    };
    window.addEventListener("hire:chat-opened", onOpened);
    window.addEventListener("hire:chat-closed", onClosed);
    window.addEventListener("hire:chat-open", onRequest);
    return () => {
      window.removeEventListener("hire:chat-opened", onOpened);
      window.removeEventListener("hire:chat-closed", onClosed);
      window.removeEventListener("hire:chat-open", onRequest);
    };
  }, [items, markSeen, summaryOf, upsert, openChat, loadConversations]);

  // mensagem nova de outra pessoa numa conversa fechada: círculo com bolinha vermelha
  useLiveEvent(async (e) => {
    if (e.type !== "conversation" || !token) return;
    const c = await summaryOf(e.id);
    if (openIds.current.has(e.id)) return;
    const last = c?.lastMessage;
    if (!c || !last || last.role === c.myRole) return;
    let seen: string | undefined;
    try { seen = seenKey ? (JSON.parse(localStorage.getItem(seenKey) ?? "{}") as Record<string, string>)[c.id] : undefined; } catch { /* ignora */ }
    if (seen && new Date(last.createdAt) <= new Date(seen)) return;
    upsert({ conversationId: c.id, ...counterpart(c), unread: true });
  });

  const unreadCount = items.filter((i) => i.unread).length;
  const openInbox = useCallback(() => {
    setPanelOpen(true);
    loadConversations();
  }, [loadConversations]);

  // pilha visível: quando passa do que cabe, os mais antigos vão para o círculo "+N"
  const docked = items.filter((i) => i.conversationId !== active?.id);
  const overflowing = docked.length > capacity;
  const visible = overflowing ? docked.slice(0, capacity - 1) : docked;
  const hidden = overflowing ? docked.slice(capacity - 1) : [];
  const hiddenUnread = hidden.some((i) => i.unread);
  const dismiss = (id: number) => setItems((list) => list.filter((i) => i.conversationId !== id));
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <ChatDockContext.Provider value={{ unreadCount, openInbox }}>
      {children}
      {token && (
        <>
          {/* pilha de conversas minimizadas (a mais nova em cima) */}
          <ul className="fixed right-4 sm:right-6 bottom-24 sm:bottom-6 z-40 flex flex-col gap-3" aria-label="Conversas minimizadas">
            <AnimatePresence>
              {overflowing && (
                <motion.li key="overflow" layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="relative">
                  <button
                    type="button"
                    onClick={() => setOverflowOpen((v) => !v)}
                    aria-expanded={overflowOpen}
                    aria-label={`Mais ${hidden.length} conversas minimizadas`}
                    className="w-14 h-14 rounded-full border-4 border-[var(--primary)] bg-[var(--bg-light)] text-[var(--text)] font-bold shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:scale-105 transition-transform"
                  >
                    +{hidden.length}
                  </button>
                  {hiddenUnread && <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 ring-2 ring-[var(--bg-dark)]" aria-hidden />}
                  <AnimatePresence>
                    {overflowOpen && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="absolute right-full top-0 mr-3 w-72 max-h-[60vh] overflow-y-auto rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-xl p-2"
                      >
                        <p className="px-2 py-1 text-xs text-[var(--text-muted)]">Mais conversas minimizadas</p>
                        {hidden.map((i) => (
                          <div key={i.conversationId} className="flex items-center gap-2 p-2 rounded-xl hover:bg-[var(--bg-light)]">
                            <button type="button" onClick={() => openChat(i.conversationId)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                              <span className="relative shrink-0">
                                <img src={i.avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-[var(--primary)]" />
                                {i.unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" aria-hidden />}
                              </span>
                              <span className="text-sm truncate">{i.name}</span>
                            </button>
                            <button type="button" onClick={() => dismiss(i.conversationId)} aria-label={`Tirar ${i.name} da pilha`} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              )}
              {visible.map((item) => (
                <motion.li
                  key={item.conversationId}
                  layout
                  initial={{ opacity: 0, scale: 0.6, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.6, x: 20 }}
                  className="relative group"
                >
                  <Circle item={item} onOpen={() => openChat(item.conversationId)} onDismiss={() => dismiss(item.conversationId)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {/* painel de conversas em andamento: fica aberto enquanto a pessoa quiser */}
          <AnimatePresence>
            {panelOpen && !(isMobile && active) && (
              <motion.aside
                role="dialog"
                aria-labelledby="conversations-title"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="fixed z-[55] left-0 right-0 top-0 bottom-0 md:left-6 md:right-auto md:top-24 md:bottom-6 md:w-[360px] flex flex-col bg-[var(--bg-light)] md:rounded-2xl shadow-2xl border border-[var(--border)] text-[var(--text)]"
              >
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                  <h2 id="conversations-title" className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare size={20} className="text-[var(--primary)]" /> Conversas
                  </h2>
                  <button onClick={() => setPanelOpen(false)} aria-label="Fechar conversas" className="text-[var(--text-muted)] hover:text-[var(--primary)]">
                    <X size={22} />
                  </button>
                </div>
                <div className="overflow-y-auto p-3 flex flex-col gap-2">
                  {conversations === null ? (
                    [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-[var(--bg)] animate-pulse" />)
                  ) : conversations.length === 0 ? (
                    <p className="p-6 text-center text-[var(--text-muted)]">Nenhuma conversa ainda. Abra um serviço ou um perfil e toque em <strong>Chat</strong>.</p>
                  ) : (
                    conversations.map((c) => {
                      const { name, avatar } = counterpart(c);
                      const unread = items.some((i) => i.conversationId === c.id && i.unread);
                      const isActive = active?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => openChat(c.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={`flex items-center gap-3 p-3 rounded-lg bg-[var(--bg)] border transition text-left ${isActive ? "border-[var(--primary)]" : "border-[var(--border-muted)] hover:border-[var(--highlight)]"}`}
                        >
                          <span className="relative shrink-0">
                            <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[var(--primary)]" />
                            {unread && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" aria-hidden />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{name}</span>
                              <span className="text-xs text-[var(--text-muted)] shrink-0">{conversationStatus(c)}</span>
                            </div>
                            <div className="text-xs text-[var(--text-muted)] truncate">{c.service?.title ?? "Conversa geral"}</div>
                            {c.lastMessage && <div className="text-sm text-[var(--text-muted)] truncate mt-0.5">{c.lastMessage.text}</div>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* chat aberto: fechar não reabre o painel; fechado, vai para a pilha se a pessoa escreveu */}
          {active && (
            <ServiceFormalizerModal
              key={active.id}
              conversationId={active.id}
              initialDraft={active.draft}
              isOpen
              onClose={() => { setActive(null); loadConversations(); }}
            />
          )}
        </>
      )}
    </ChatDockContext.Provider>
  );
}
