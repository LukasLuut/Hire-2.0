import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowDown, BadgeCheck, CircleX, FileText, Handshake, Loader2, Minus, PanelRightClose, PanelRightOpen, Paperclip, ScrollText, SendHorizontal, X, CircleCheck } from "lucide-react";
import type { ChatMessage, ConversationDetail, Negotiation } from "../../interfaces/Entities";
import { conversationAPI, type NegotiationResult } from "../../api/ConversationAPI";
import { emitChatClosed, emitChatOpened } from "../../utils/chatEvents";
import { liveConnected, subscribe } from "../../utils/liveEvents";
import { uploadUrl } from "../../utils/avatar";
import { getErrorMessage } from "../../utils/errors";
import { useToast } from "../Toast/ToastContext";
import NegotiationPanel from "./NegotiationPanel";
import NewNegotiation from "./NewNegotiation";
import { DUR, EASE_OUT, TONE_CLASS, counterpartOf, dayLabel, firstName, negotiationStatus, timeLabel } from "./chatUi";

/* --------------------------------------------------------------------------
 * Sala da conversa (v2): a conversa do par nunca fecha.
 * - Esquerda: mensagens livres e os marcos das negociações como cards.
 * - Direita: a negociação em foco (tópicos, aceite) ou o convite para negociar.
 * - Mobile: tela cheia; a negociação abre como folha por cima.
 * Mensagens chegam por SSE; o polling é só reserva. Uma busca por vez (sem duplicar).
 * -------------------------------------------------------------------------- */

const POLL_MS = 4000;
const POLL_LIVE_MS = 30_000;
const MESSAGE_MAX = 2000;
// distância do fim da lista até onde ainda "acompanha" as mensagens novas
const STICK_PX = 120;

type Props = {
  conversationId: number;
  initialDraft?: string;
  /** painel de conversas aberto ao lado (a sala fica mais estreita no desktop) */
  beside?: boolean;
  onClose: () => void;
  onMinimize: () => void;
};

export default function ChatRoom({ conversationId, initialDraft, beside = false, onClose, onMinimize }: Props) {
  const { showToast } = useToast();
  const token = localStorage.getItem("token") ?? "";
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState(initialDraft ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [closedNow, setClosedNow] = useState<Negotiation | null>(null);
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null); // null = decide pelo conteúdo
  const [creating, setCreating] = useState(false);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const lastIdRef = useRef(0);
  const loadingRef = useRef(false);
  const queuedRef = useRef(false);
  const sentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStatus = useRef(new Map<number, Negotiation["status"]>());

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // avisa o dock: abriu; ao fechar, se a pessoa escreveu, a conversa fica minimizada
  useEffect(() => {
    sentRef.current = false;
    emitChatOpened(conversationId);
    return () => {
      emitChatClosed(conversationId, sentRef.current);
    };
  }, [conversationId]);

  /** Busca a conversa (tudo na primeira vez; depois só o que é novo). Nunca duas ao mesmo tempo. */
  const load = useCallback(
    async (initial = false) => {
      if (loadingRef.current) {
        queuedRef.current = true;
        return;
      }
      loadingRef.current = true;
      try {
        const data = await conversationAPI.get(conversationId, token, initial ? undefined : lastIdRef.current);
        setConv(data);
        // negociação que virou contrato agora: mostra o fechamento e limpa o painel
        for (const n of data.negotiations) {
          const before = prevStatus.current.get(n.id);
          if (before === "OPEN" && n.status === "FORMALIZED") setClosedNow(n);
          prevStatus.current.set(n.id, n.status);
        }
        if (data.messages.length) {
          lastIdRef.current = data.messages[data.messages.length - 1].id;
          setMessages((prev) => {
            if (initial) return data.messages;
            const seen = new Set(prev.map((m) => m.id));
            const fresh = data.messages.filter((m) => !seen.has(m.id));
            if (fresh.length && !stickRef.current) setUnseenBelow((n) => n + fresh.filter((m) => m.role !== data.myRole).length);
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          if (data.unread > 0) conversationAPI.markRead(conversationId, token).catch(() => null);
        }
        setLoadError(null);
      } catch (err) {
        if (initial) setLoadError(getErrorMessage(err, "Não foi possível abrir a conversa."));
      } finally {
        loadingRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          load(false);
        }
      }
    },
    [conversationId, token]
  );

  useEffect(() => {
    lastIdRef.current = 0;
    prevStatus.current = new Map();
    setMessages([]);
    load(true).then(() => conversationAPI.markRead(conversationId, token).catch(() => null));
    let last = Date.now();
    const timer = setInterval(() => {
      if (liveConnected() && Date.now() - last < POLL_LIVE_MS) return;
      last = Date.now();
      load(false);
    }, POLL_MS);
    const unsubscribe = subscribe((e) => {
      if (e.type === "conversation" && e.id === conversationId) load(false);
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [conversationId, token, load]);

  // negociação em foco: a escolhida; senão a aberta em destaque
  const negotiations = useMemo(() => conv?.negotiations ?? [], [conv?.negotiations]);
  const openCount = negotiations.filter((n) => n.status === "OPEN").length;
  const focused = useMemo(() => {
    const chosen = negotiations.find((n) => n.id === focusId);
    if (chosen) return chosen;
    return negotiations.find((n) => n.id === conv?.negotiation?.id && n.status === "OPEN") ?? negotiations.find((n) => n.status === "OPEN") ?? null;
  }, [negotiations, focusId, conv?.negotiation?.id]);
  const showPanel = panelOpen ?? (!isMobile && (openCount > 0 || !!closedNow));

  // acompanha o fim da conversa só se a pessoa já estava lá
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    if (stickRef.current) setUnseenBelow(0);
  };
  const toBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickRef.current = true;
    setUnseenBelow(0);
  };

  // Esc: primeiro fecha a folha de negociação; depois a sala
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || creating) return;
      if (isMobile && panelOpen) setPanelOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating, isMobile, panelOpen, onClose]);

  // rascunho inicial: cursor no fim
  useEffect(() => {
    if (!initialDraft || !inputRef.current) return;
    const el = inputRef.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [initialDraft]);

  // campo cresce com o texto (até 5 linhas)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }, [text]);

  const send = async () => {
    const clean = text.trim();
    if ((!clean && !file) || sending) return;
    if (clean.length > MESSAGE_MAX) return;
    setSending(true);
    try {
      await conversationAPI.send(conversationId, clean, token, file);
      sentRef.current = true;
      setText("");
      setFile(null);
      stickRef.current = true;
      await load(false);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível enviar a mensagem."), "error");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const focusNegotiation = (id: number) => {
    setClosedNow(null);
    setFocusId(id);
    setPanelOpen(true);
  };

  const onCreated = async (r: NegotiationResult) => {
    setCreating(false);
    setClosedNow(null);
    setFocusId(r.negotiationId);
    setPanelOpen(true);
    stickRef.current = true;
    await load(false);
  };

  if (!conv) {
    return (
      <Shell beside={beside} isMobile={isMobile} wide={false}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
          {loadError ? (
            <>
              <p>{loadError}</p>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border)]">Fechar</button>
            </>
          ) : (
            <Loader2 className="animate-spin" />
          )}
        </div>
      </Shell>
    );
  }

  const other = counterpartOf(conv);
  const profileLink = other.party === "prestador" && conv.provider ? `/prestador/${conv.provider.slug || conv.provider.id}` : null;
  const tooLong = text.trim().length > MESSAGE_MAX;

  const panel = (
    <NegotiationPanel
      conv={conv}
      focused={focused}
      closedNow={closedNow}
      onDismissClosed={() => setClosedNow(null)}
      onFocus={focusNegotiation}
      onNew={() => setCreating(true)}
      onChanged={() => load(false)}
      token={token}
    />
  );

  return (
    <Shell beside={beside} isMobile={isMobile} wide={showPanel && !isMobile}>
      {/* cabeçalho: quem é, o que está em andamento e as ações da sala */}
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-[var(--border-muted)]">
        <img src={other.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-light)]" />
        <div className="flex-1 min-w-0">
          {profileLink ? (
            <Link to={profileLink} className="block font-semibold truncate hover:underline">{other.name}</Link>
          ) : (
            <span className="block font-semibold truncate">{other.name}</span>
          )}
          <span className="block text-xs text-[var(--text-muted)] truncate">
            {other.roleLabel}
            {openCount > 0 && ` · ${openCount} ${openCount === 1 ? "negociação aberta" : "negociações abertas"}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="hidden sm:flex h-9 px-3 rounded-xl bg-[var(--primary)] text-white text-sm font-medium items-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition"
        >
          <Handshake size={17} /> Negociar
        </button>
        <IconButton
          label={showPanel ? "Esconder negociação" : "Mostrar negociação"}
          onClick={() => setPanelOpen(!showPanel)}
          badge={conv.waitingForMe}
        >
          {showPanel && !isMobile ? <PanelRightClose size={19} /> : isMobile ? <Handshake size={19} /> : <PanelRightOpen size={19} />}
        </IconButton>
        {!isMobile && (
          <IconButton label="Minimizar conversa" onClick={onMinimize}>
            <Minus size={19} />
          </IconButton>
        )}
        <IconButton label="Fechar conversa" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </header>

      <div className="flex-1 min-h-0 flex relative">
        {/* mensagens */}
        <section className="flex-1 min-w-0 flex flex-col" aria-label={`Conversa com ${other.name}`}>
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-muted)] px-6">
                <img src={other.avatar} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-[var(--primary)] ring-offset-4 ring-offset-[var(--bg-light)]" />
                <p className="mt-4 font-medium text-[var(--text)]">Comece a conversa com {firstName(other.name)}</p>
                <p className="mt-1 text-sm max-w-[280px]">Tire dúvidas à vontade. Quando quiserem fechar algo, use Negociar.</p>
              </div>
            ) : (
              <MessageList messages={messages} conv={conv} onOpenNegotiation={focusNegotiation} />
            )}
          </div>

          <AnimatePresence>
            {unseenBelow > 0 && (
              <motion.button
                type="button"
                onClick={toBottom}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: DUR.small, ease: EASE_OUT }}
                className="absolute left-1/2 -translate-x-1/2 bottom-24 z-10 h-8 px-3 rounded-full bg-[var(--primary)] text-white text-xs font-medium shadow-lg flex items-center gap-1.5"
              >
                <ArrowDown size={14} /> {unseenBelow} {unseenBelow === 1 ? "mensagem nova" : "mensagens novas"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* composer */}
          <form
            className="shrink-0 px-3 pb-3 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <AnimatePresence>
              {file && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="mb-2 inline-flex items-center gap-2 max-w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border-muted)] text-xs">
                  <Paperclip size={13} className="shrink-0" /> <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} aria-label="Remover anexo" className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <X size={13} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className={`flex items-end gap-2 rounded-2xl bg-[var(--bg)] border px-2 py-1.5 transition-colors ${tooLong ? "border-[var(--deal-no)]" : "border-[var(--border-muted)] focus-within:border-[var(--primary)]"}`}>
              <label className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-light)] cursor-pointer transition" title="Anexar imagem ou PDF">
                <Paperclip size={18} />
                <span className="sr-only">Anexar arquivo</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Mensagem para ${firstName(other.name)}`}
                aria-label="Mensagem"
                className="no-focus-ring flex-1 min-w-0 resize-none bg-transparent outline-none py-2 text-sm leading-5 max-h-[132px] placeholder:text-[var(--text-muted)]"
              />
              <motion.button
                type="submit"
                aria-label="Enviar mensagem"
                disabled={sending || tooLong || (!text.trim() && !file)}
                whileTap={{ scale: 0.92 }}
                className="w-9 h-9 mb-0.5 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 transition disabled:opacity-40"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={17} />}
              </motion.button>
            </div>
            {text.length > MESSAGE_MAX - 200 && (
              <p className={`mt-1 text-right text-[11px] ${tooLong ? "text-[var(--deal-no)]" : "text-[var(--text-muted)]"}`}>
                {text.trim().length.toLocaleString("pt-BR")} / {MESSAGE_MAX.toLocaleString("pt-BR")}
              </p>
            )}
            {isMobile && (
              <button type="button" onClick={() => setCreating(true)} className="mt-2 w-full h-10 rounded-xl border border-[var(--border-muted)] text-sm flex items-center justify-center gap-2 text-[var(--text)]">
                <Handshake size={16} className="text-[var(--primary)]" /> Negociar
              </button>
            )}
          </form>
        </section>

        {/* negociação: coluna no desktop, folha no mobile */}
        <AnimatePresence initial={false}>
          {showPanel && !isMobile && (
            <motion.aside
              key="panel"
              aria-label="Negociação"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: DUR.panel, ease: EASE_OUT }}
              className="w-[340px] shrink-0 border-l border-[var(--border-muted)] bg-[color-mix(in_oklch,var(--bg-light)_70%,var(--bg))] min-h-0"
            >
              {panel}
            </motion.aside>
          )}
          {showPanel && isMobile && (
            <motion.div key="sheet" className="absolute inset-0 z-10 flex flex-col justify-end bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setPanelOpen(false)}>
              <motion.div
                role="dialog"
                aria-label="Negociação"
                className="max-h-[85%] min-h-[50%] flex flex-col rounded-t-3xl bg-[var(--bg-light)] border-t border-[var(--border)]"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DUR.panel, ease: EASE_OUT }}
              >
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="mx-auto w-10 h-1 rounded-full bg-[var(--border)]" aria-hidden />
                </div>
                <div className="flex items-center justify-between px-4 pt-2">
                  <span className="font-semibold">Negociação</span>
                  <IconButton label="Fechar negociação" onClick={() => setPanelOpen(false)}>
                    <X size={18} />
                  </IconButton>
                </div>
                <div className="flex-1 min-h-0">{panel}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{creating && <NewNegotiation conv={conv} token={token} onClose={() => setCreating(false)} onCreated={onCreated} />}</AnimatePresence>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ moldura da sala */

function Shell({ children, beside, isMobile, wide }: { children: React.ReactNode; beside: boolean; isMobile: boolean; wide: boolean }) {
  // desktop: janela no canto direito; mais larga com a negociação aberta; mais estreita com o painel de conversas ao lado
  const width = wide ? (beside ? "min(940px, calc(100vw - 432px))" : "min(940px, calc(100vw - 48px))") : beside ? "min(560px, calc(100vw - 432px))" : "min(560px, calc(100vw - 48px))";
  return (
    <motion.div
      data-chat-room
      role="dialog"
      aria-label="Conversa"
      initial={isMobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1, width }}
      exit={isMobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: DUR.panel, ease: EASE_OUT }}
      style={isMobile ? undefined : { width }}
      className={
        isMobile
          ? "fixed inset-0 z-[60] flex flex-col bg-[var(--bg-light)] text-[var(--text)]"
          : "fixed z-[60] right-6 bottom-6 top-24 flex flex-col overflow-hidden rounded-3xl bg-[var(--bg-light)] text-[var(--text)] border border-[var(--border)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
      }
    >
      {children}
    </motion.div>
  );
}

function IconButton({ label, onClick, children, badge = false }: { label: string; onClick: () => void; children: React.ReactNode; badge?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition">
      {children}
      {badge && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--deal-wait)] ring-2 ring-[var(--bg-light)]" aria-hidden />}
    </button>
  );
}

/* ------------------------------------------------------------------ mensagens */

const EVENT_META: Record<string, { icon: typeof Handshake; tone: keyof typeof TONE_CLASS }> = {
  "negotiation.opened": { icon: Handshake, tone: "mine" },
  "negotiation.proposal": { icon: FileText, tone: "mine" },
  "negotiation.accepted": { icon: CircleCheck, tone: "ok" },
  "negotiation.formalized": { icon: BadgeCheck, tone: "ok" },
  "negotiation.rejected": { icon: CircleX, tone: "no" },
  "negotiation.closed": { icon: CircleX, tone: "no" },
};

function MessageList({ messages, conv, onOpenNegotiation }: { messages: ChatMessage[]; conv: ConversationDetail; onOpenNegotiation: (id: number) => void }) {
  const me = conv.myRole;
  const other = counterpartOf(conv);
  const byId = new Map(conv.negotiations.map((n) => [n.id, n]));
  return (
    <ol className="flex flex-col gap-1.5">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
        // mensagens seguidas da mesma pessoa ficam agrupadas (menos espaço, cantos contínuos)
        const grouped = !!prev && !newDay && prev.role === m.role && m.role !== "system" && !prev.event && !m.event;
        const n = m.negotiationId ? byId.get(m.negotiationId) : undefined;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li className="flex justify-center my-3" aria-hidden>
                <span className="px-3 py-1 rounded-full bg-[var(--bg)] text-[11px] text-[var(--text-muted)]">{dayLabel(m.createdAt)}</span>
              </li>
            )}
            <motion.li
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.small, ease: EASE_OUT }}
              className={grouped ? "" : "mt-1.5"}
            >
              {m.event && n ? (
                <EventCard m={m} n={n} conv={conv} otherName={other.name} onOpen={() => onOpenNegotiation(n.id)} />
              ) : m.role === "system" ? (
                <p className="text-center text-xs text-[var(--text-muted)] px-6 py-1">{m.text}</p>
              ) : (
                <Bubble m={m} mine={m.role === me} />
              )}
            </motion.li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const url = uploadUrl(m.attachmentUrl);
  const isImage = !!m.attachmentName && /\.(png|jpe?g|webp|gif)$/i.test(m.attachmentName);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] px-3.5 py-2 text-sm leading-relaxed rounded-2xl break-words whitespace-pre-line
          ${mine ? "bg-[var(--primary)] text-white rounded-br-md" : "bg-[var(--bg)] text-[var(--text)] border border-[var(--border-muted)] rounded-bl-md"}`}
      >
        {url && isImage && (
          <a href={url} target="_blank" rel="noreferrer" className="block -mx-1.5 -mt-0.5 mb-1.5">
            <img src={url} alt={m.attachmentName ?? "Imagem"} className="rounded-xl max-h-56 object-cover" loading="lazy" />
          </a>
        )}
        {url && !isImage && (
          <a href={url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 mb-1 underline-offset-2 hover:underline ${mine ? "text-white" : "text-[var(--primary)]"}`}>
            <Paperclip size={14} /> {m.attachmentName}
          </a>
        )}
        {!(url && m.text === "Arquivo enviado") && <span>{m.text}</span>}
        <span className={`block text-right text-[10px] mt-0.5 ${mine ? "text-white/75" : "text-[var(--text-muted)]"}`}>{timeLabel(m.createdAt)}</span>
      </div>
    </div>
  );
}

/** Marco de negociação: card clicável que leva ao painel daquela negociação */
function EventCard({ m, n, conv, otherName, onOpen }: { m: ChatMessage; n: Negotiation; conv: ConversationDetail; otherName: string; onOpen: () => void }) {
  const meta = EVENT_META[m.event ?? ""] ?? EVENT_META["negotiation.opened"];
  const status = negotiationStatus(n, conv.myRole, otherName);
  const formalized = m.event === "negotiation.formalized";
  return (
    <div className="flex justify-center">
      <div className={`w-full max-w-[420px] rounded-2xl border p-3 bg-[var(--bg)] ${formalized ? "border-[color-mix(in_oklch,var(--deal-ok)_45%,transparent)]" : "border-[var(--border-muted)]"}`}>
        <div className="flex items-start gap-3">
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${TONE_CLASS[meta.tone]}`}>
            <meta.icon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm whitespace-pre-line break-words">{m.text}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASS[status.tone]}`}>{status.text}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{timeLabel(m.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onOpen} className="h-8 px-3 rounded-lg text-xs font-medium border border-[var(--border-muted)] hover:border-[var(--primary)] transition">
            {n.status === "OPEN" ? "Ver negociação" : "Detalhes"}
          </button>
          {formalized && n.contractId && (
            <Link to={`/contract/${n.contractId}`} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-[var(--primary)] text-white hover:brightness-110 transition">
              <ScrollText size={14} /> Ver contrato
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
