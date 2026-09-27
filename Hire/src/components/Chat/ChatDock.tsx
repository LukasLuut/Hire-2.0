import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BadgeCheck, CircleX, Handshake, Inbox, MessageSquare, Search, X } from "lucide-react";
import { ChatDockContext } from "./chatDockContext";
import ChatRoom from "./ChatRoom";
import { conversationAPI, type ConversationFilter } from "../../api/ConversationAPI";
import type { ConversationSummary } from "../../interfaces/Entities";
import { useSession } from "../../context/SessionContext";
import { useLiveEvent } from "../../utils/liveEvents";
import type { ChatClosed, ChatOpened, ChatOpenRequest } from "../../utils/chatEvents";
import { DUR, EASE_OUT, TONE_CLASS, counterpartOf, listTime } from "./chatUi";

/* --------------------------------------------------------------------------
 * ChatDock — central de conversas.
 * - Painel "Conversas" (ícone da navbar): uma linha por pessoa, com busca, filtros e
 *   o que espera você. Fica aberto; escolher uma conversa abre a sala ao lado.
 * - Sala: uma por vez; abrir outra minimiza a atual.
 * - Minimizadas: círculos com a foto da outra parte no canto direito; o excedente vira "+N".
 * - Não lidas vêm do servidor (valem em qualquer aparelho); a pilha vale para a sessão.
 * -------------------------------------------------------------------------- */
type DockItem = { conversationId: number; name: string; avatar: string; unread: boolean };

// círculo 56px + espaço 12px; reserva para a navbar, o respiro do topo e o canto de baixo
const SLOT = 68;
const RESERVED_DESKTOP = 72 + 24 + 24 + 40;
const RESERVED_MOBILE = 72 + 24 + 96 + 40;
const PAGE = 30;

const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento: só na memória */
  }
};

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

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

const toItem = (c: ConversationSummary, unread = false): DockItem => {
  const o = counterpartOf(c);
  return { conversationId: c.id, name: o.name, avatar: o.avatar, unread };
};

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

const FILTERS: { value: ConversationFilter; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "negotiating", label: "Negociando" },
];

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { token, user } = useSession();
  const storeKey = user ? `hire.chatDock.${user.id}` : null;
  const [items, setItems] = useState<DockItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("");
  const [unreadIds, setUnreadIds] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<{ id: number; draft?: string } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const openIds = useRef(new Set<number>());
  const lastKey = useRef<string | null>(null);
  const listSeq = useRef(0);
  const capacity = useDockCapacity();
  const isMobile = useIsMobile();

  // pilha da sessão: carrega ao entrar; ao sair da conta, apaga
  useEffect(() => {
    if (!storeKey && lastKey.current) {
      try {
        sessionStorage.removeItem(lastKey.current);
      } catch {
        /* ignora */
      }
    }
    lastKey.current = storeKey;
    setItems(storeKey ? read<DockItem[]>(storeKey, []) : []);
    setActive(null);
    setPanelOpen(false);
    setConversations(null);
    setUnreadIds(new Set());
  }, [storeKey]);
  useEffect(() => {
    if (storeKey) write(storeKey, items);
  }, [items, storeKey]);

  // não lidas guardadas no servidor: ao entrar, já sabe o que chegou enquanto estava fora
  useEffect(() => {
    if (!token) return;
    conversationAPI
      .list(token, { filter: "unread", limit: 100 })
      .then((list) => setUnreadIds(new Set(list.filter((c) => c.unread > 0).map((c) => c.id))))
      .catch(() => null);
  }, [token]);

  const setUnread = useCallback((id: number, unread: boolean) => {
    setUnreadIds((prev) => {
      if (prev.has(id) === unread) return prev;
      const next = new Set(prev);
      if (unread) next.add(id);
      else next.delete(id);
      return next;
    });
    setItems((list) => list.map((i) => (i.conversationId === id ? { ...i, unread } : i)));
  }, []);

  const upsert = useCallback((item: DockItem) => {
    setItems((list) => [item, ...list.filter((i) => i.conversationId !== item.conversationId)].slice(0, 60));
  }, []);

  /** Lista do painel (página 1 ou a próxima), com a busca e o filtro atuais */
  const loadConversations = useCallback(
    async (more = false) => {
      if (!token) return;
      const seq = ++listSeq.current;
      const offset = more ? conversations?.length ?? 0 : 0;
      const page = await conversationAPI.list(token, { limit: PAGE, offset, q: query, filter }).catch(() => [] as ConversationSummary[]);
      if (seq !== listSeq.current) return; // resposta de uma busca antiga
      setConversations((prev) => (more && prev ? [...prev, ...page.filter((c) => !prev.some((p) => p.id === c.id))] : page));
      setHasMore(page.length === PAGE);
      // o servidor é a fonte das não lidas; a conversa aberta conta como lida
      setUnreadIds((prev) => {
        const next = new Set(prev);
        for (const c of page) {
          if (c.unread > 0 && !openIds.current.has(c.id)) next.add(c.id);
          else next.delete(c.id);
        }
        return next;
      });
    },
    [token, query, filter, conversations?.length]
  );

  // busca e filtro recarregam o painel (com uma pausa enquanto digita)
  useEffect(() => {
    if (!panelOpen) return;
    const t = setTimeout(() => loadConversations(false), query ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, query, filter, token]);

  /** Atualiza uma conversa no painel sem recarregar a lista inteira */
  const refreshOne = useCallback(
    async (id: number) => {
      if (!token) return null;
      const c = await conversationAPI.summary(id, token).catch(() => null);
      if (!c) return null;
      // mantém a ordem da lista: última mensagem mais recente primeiro
      const at = (x: ConversationSummary) => +new Date(x.lastMessageAt ?? x.lastMessage?.createdAt ?? 0);
      setConversations((prev) => (prev ? [c, ...prev.filter((p) => p.id !== id)].sort((a, b) => at(b) - at(a)) : prev));
      return c;
    },
    [token]
  );

  /** Abre uma conversa; a que estava aberta vai para a pilha */
  const openChat = useCallback(
    async (id: number, draft?: string) => {
      setOverflowOpen(false);
      if (active && active.id !== id) {
        const current = conversations?.find((c) => c.id === active.id) ?? (await refreshOne(active.id));
        if (current) upsert(toItem(current));
      }
      setUnread(id, false);
      setActive({ id, draft });
    },
    [active, conversations, refreshOne, upsert, setUnread]
  );

  const minimize = useCallback(async () => {
    if (!active) return;
    const id = active.id;
    setActive(null);
    const c = conversations?.find((x) => x.id === id) ?? (await refreshOne(id));
    if (c) upsert(toItem(c));
  }, [active, conversations, refreshOne, upsert]);

  useEffect(() => {
    const onOpened = (e: Event) => {
      const { conversationId } = (e as CustomEvent<ChatOpened>).detail;
      openIds.current.add(conversationId);
      setUnread(conversationId, false);
    };
    // uma sala fechou: se a pessoa escreveu (ou já estava na pilha), a conversa fica minimizada
    const onClosed = async (e: Event) => {
      const { conversationId, sent } = (e as CustomEvent<ChatClosed>).detail;
      openIds.current.delete(conversationId);
      const c = await refreshOne(conversationId);
      setUnread(conversationId, false);
      if (!sent && !items.some((i) => i.conversationId === conversationId)) return;
      if (c) upsert(toItem(c));
    };
    // outras telas pedem para abrir uma conversa (ou a lista)
    const onRequest = (e: Event) => {
      const { conversationId, draft } = (e as CustomEvent<ChatOpenRequest>).detail;
      if (conversationId) openChat(conversationId, draft);
      else setPanelOpen(true);
    };
    window.addEventListener("hire:chat-opened", onOpened);
    window.addEventListener("hire:chat-closed", onClosed);
    window.addEventListener("hire:chat-open", onRequest);
    return () => {
      window.removeEventListener("hire:chat-opened", onOpened);
      window.removeEventListener("hire:chat-closed", onClosed);
      window.removeEventListener("hire:chat-open", onRequest);
    };
  }, [items, refreshOne, upsert, openChat, setUnread]);

  // mensagem nova numa conversa fechada: atualiza a linha e mostra o círculo com bolinha vermelha
  useLiveEvent(async (e) => {
    if (e.type !== "conversation" || !token) return;
    if (openIds.current.has(e.id)) return;
    const c = panelOpen ? await refreshOne(e.id) : await conversationAPI.summary(e.id, token).catch(() => null);
    if (!c || c.unread <= 0) return;
    setUnread(c.id, true);
    upsert(toItem(c, true));
  });

  const unreadCount = unreadIds.size;
  const openInbox = useCallback(() => setPanelOpen(true), []);

  // pilha visível: quando passa do que cabe, os mais antigos vão para o círculo "+N"
  const docked = items.filter((i) => i.conversationId !== active?.id);
  const overflowing = docked.length > capacity;
  const visible = overflowing ? docked.slice(0, capacity - 1) : docked;
  const hidden = overflowing ? docked.slice(capacity - 1) : [];
  const hiddenUnread = hidden.some((i) => i.unread);
  const dismiss = (id: number) => setItems((list) => list.filter((i) => i.conversationId !== id));

  return (
    <ChatDockContext.Provider value={{ unreadCount, openInbox }}>
      {children}
      {token && (
        <MotionConfig reducedMotion="user">
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

          {/* painel de conversas: fica aberto enquanto a pessoa quiser */}
          <AnimatePresence>
            {panelOpen && !(isMobile && active) && (
              <motion.aside
                role="dialog"
                aria-labelledby="conversations-title"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: DUR.panel, ease: EASE_OUT }}
                className="fixed z-[55] left-0 right-0 top-0 bottom-0 md:left-6 md:right-auto md:top-24 md:bottom-6 md:w-[360px] flex flex-col bg-[var(--bg-light)] md:rounded-3xl shadow-2xl border border-[var(--border)] text-[var(--text)] overflow-hidden"
              >
                <div className="px-4 pt-4 pb-3 border-b border-[var(--border-muted)]">
                  <div className="flex items-center justify-between">
                    <h2 id="conversations-title" className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare size={20} className="text-[var(--primary)]" /> Conversas
                    </h2>
                    <button onClick={() => setPanelOpen(false)} aria-label="Fechar conversas" className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition">
                      <X size={20} />
                    </button>
                  </div>
                  <label className="mt-3 flex items-center gap-2 h-10 px-3 rounded-xl bg-[var(--bg)] border border-[var(--border-muted)] focus-within:border-[var(--primary)] transition-colors">
                    <Search size={16} className="text-[var(--text-muted)] shrink-0" aria-hidden />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar pessoa ou serviço"
                      aria-label="Buscar conversas"
                      className="no-focus-ring flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-[var(--text-muted)]"
                    />
                    {query && (
                      <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="text-[var(--text-muted)] hover:text-[var(--text)]">
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Filtrar conversas">
                    {FILTERS.map((f) => (
                      <button
                        key={f.value || "all"}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={`relative h-8 px-3 rounded-full text-xs font-medium transition-colors ${filter === f.value ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                      >
                        {filter === f.value && <motion.span layoutId="conv-filter" className="absolute inset-0 rounded-full bg-[var(--primary)]" transition={{ duration: DUR.small, ease: EASE_OUT }} />}
                        <span className="relative">
                          {f.label}
                          {f.value === "unread" && unreadCount > 0 && ` (${unreadCount})`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  {conversations === null ? (
                    [0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <div className="w-12 h-12 rounded-full bg-[var(--bg)] animate-pulse" />
                        <div className="flex-1 grid gap-2">
                          <div className="h-3 w-1/2 rounded bg-[var(--bg)] animate-pulse" />
                          <div className="h-3 w-3/4 rounded bg-[var(--bg)] animate-pulse" />
                        </div>
                      </div>
                    ))
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center text-center px-6 py-10 text-[var(--text-muted)]">
                      <Inbox size={28} />
                      <p className="mt-3 text-sm">
                        {query ? "Nada encontrado com essa busca." : filter === "unread" ? "Tudo lido por aqui." : filter === "negotiating" ? "Nenhuma negociação aberta." : "Nenhuma conversa ainda. Abra um serviço ou um perfil e toque em Chat."}
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-0.5 min-w-0">
                      <AnimatePresence initial={false}>
                        {conversations.map((c) => (
                          <motion.li key={c.id} className="min-w-0" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: DUR.small, ease: EASE_OUT }}>
                            <ConversationRow c={c} active={active?.id === c.id} unread={unreadIds.has(c.id) ? Math.max(c.unread, 1) : 0} onOpen={() => openChat(c.id)} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                      {hasMore && (
                        <li className="p-2">
                          <button type="button" onClick={() => loadConversations(true)} className="w-full h-9 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition">
                            Carregar mais
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* sala aberta: fechar não reabre o painel; minimizar leva para a pilha */}
          <AnimatePresence>
            {active && (
              <ChatRoom
                key={active.id}
                conversationId={active.id}
                initialDraft={active.draft}
                beside={panelOpen && !isMobile}
                onClose={() => setActive(null)}
                onMinimize={minimize}
              />
            )}
          </AnimatePresence>
        </MotionConfig>
      )}
    </ChatDockContext.Provider>
  );
}

/** Uma linha por pessoa: foto, última mensagem e o que está em andamento */
function ConversationRow({ c, active, unread, onOpen }: { c: ConversationSummary; active: boolean; unread: number; onOpen: () => void }) {
  const o = counterpartOf(c);
  const last = c.lastMessage;
  const mine = last && last.role === c.myRole;
  const isEvent = last?.role === "system";
  return (
    <button
      type="button"
      data-conv
      onClick={onOpen}
      aria-current={active ? "true" : undefined}
      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-colors duration-150 ${active ? "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)]" : "hover:bg-[var(--bg)]"}`}
    >
      <span className="relative shrink-0">
        <img src={o.avatar} alt="" className={`w-12 h-12 rounded-full object-cover border-2 ${active ? "border-[var(--primary)]" : "border-transparent"}`} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-[var(--bg-light)]">
            {unread > 9 ? "9+" : unread}
            <span className="sr-only"> não lidas</span>
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className={`truncate flex-1 ${unread ? "font-semibold" : "font-medium"}`}>{o.name}</span>
          <span className={`text-[11px] shrink-0 ${unread ? "text-[var(--primary)] font-medium" : "text-[var(--text-muted)]"}`}>{listTime(c.lastMessageAt ?? last?.createdAt)}</span>
        </span>
        <span className={`flex items-center gap-1 text-sm truncate ${unread ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
          {isEvent && last?.event === "negotiation.formalized" && <BadgeCheck size={14} className="shrink-0 text-[var(--deal-ok)]" aria-hidden />}
          {isEvent && (last?.event === "negotiation.rejected" || last?.event === "negotiation.closed") && <CircleX size={14} className="shrink-0 text-[var(--deal-no)]" aria-hidden />}
          {isEvent && (last?.event === "negotiation.opened" || last?.event === "negotiation.proposal" || last?.event === "negotiation.accepted") && <Handshake size={14} className="shrink-0 text-[var(--primary)]" aria-hidden />}
          <span className="truncate">
            {mine ? "Você: " : ""}
            {last?.text ?? "Sem mensagens ainda"}
          </span>
        </span>
        {(c.waitingForMe || c.openNegotiations > 0) && (
          <span className="mt-1.5 flex gap-1.5">
            {c.waitingForMe ? (
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASS.wait}`}>Aguardando você</span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASS.mine}`}>
                {c.openNegotiations === 1 ? "Negociação aberta" : `${c.openNegotiations} negociações abertas`}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}
