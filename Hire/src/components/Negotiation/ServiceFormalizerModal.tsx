// ServiceNegotiationModal.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  DollarSign,
  Calendar,
  Timer,
  Handshake,
  CheckCircle,
  XCircle,
  X,
  Send,
  Paperclip,
  FileText,
} from "lucide-react";
import { conversationAPI } from "../../api/ConversationAPI";
import type { ChatMessage, ConversationSummary } from "../../interfaces/Entities";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { uploadUrl } from "../../utils/avatar";

/* ==========================================================================
   SECTION: Types (o Service que você especificou + tipos internos)
   ========================================================================= */

export interface Service {
  id?: number;
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
  price?: string;
  deliveryTime?: string;
  paymentMethod?: string;
  startDate?: string;
  duration?: string;
  attachments?: File[];
}

type TopicKey = "service" | "payment" | "start" | "duration" | "finalize";

type TopicState = "Acordado" | "Pendente" | "Negado";

interface Topic {
  key: TopicKey;
  label: string;
  tooltip: string;
  state: TopicState;
  // content aqui é string livre (pode conter resumo do tópico). Para campos específicos
  // usamos inputs no UI e sincronizamos esse content quando necessário.
  content: string;
}

/* -------------------------------------------------------------------------- */
/* ======================= SECTION: Helper / UI utilities ==================== */
/* -------------------------------------------------------------------------- */

const stateColor = (state: TopicState) =>
  state === "Acordado"
    ? "bg-green-500 text-white"
    : state === "Pendente"
    ? "bg-[var(--primary)] text-black"
    : "bg-red-500 text-white";

/* ==========================================================================
   SECTION: Component - ServiceNegotiationModal
   - Negociação real entre cliente e prestador (conversationId vindo da API)
   - Tópicos são salvos automaticamente; mensagens chegam por polling (4 s)
   ========================================================================= */

const POLL_MS = 4000;

type UiMessage = {
  id: string;
  sender: "prestador" | "cliente" | "system";
  text: string;
  time: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

function toUiMessage(m: ChatMessage): UiMessage {
  return {
    id: String(m.id),
    sender: m.role,
    text: m.text,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    attachmentUrl: uploadUrl(m.attachmentUrl),
    attachmentName: m.attachmentName,
  };
}

export default function ServiceNegotiationModal({
  service: initialService,
  conversationId,
  isOpen,
  onClose,
  onFormalize, // callback opcional depois de formalizar
}: {
  service?: Service;
  conversationId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onFormalize?: (result: { hireId: number; contractId: number; code: string }) => void;
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  /* ---------------------------- states ---------------------------------- */

  // tópicos da negociação (vêm da API)
  const [topics, setTopics] = useState<Topic[]>([]);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // referência ao tópico aberto (expandido). Null = nada expandido.
  const [expandedTopic, setExpandedTopic] = useState<TopicKey | null>(null);

  // Mensagens do chat
  const [messages, setMessages] = useState<UiMessage[]>([]);

  // input do chat
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  // confirmação animada (formalize / close)
  const [confirming, setConfirming] = useState<null | "formalize" | "close">(null);

  // para comportamento responsivo (mobile full-screen vs desktop floating)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<number>(0);
  const dirtyRef = useRef(false); // há edição local ainda não salva
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = localStorage.getItem("token") ?? "";
  const myRole = conversation?.myRole ?? "cliente";
  const isOpenNegotiation = conversation?.status === "OPEN";
  const counterpart =
    myRole === "cliente"
      ? conversation?.provider?.companyName || conversation?.provider?.professionalName
      : conversation?.client?.name;

  /* ---------------------------- effects ---------------------------------- */

  // carrega a conversa e busca novas mensagens periodicamente
  useEffect(() => {
    if (!isOpen || !conversationId) return;
    let active = true;
    lastIdRef.current = 0;
    setMessages([]);
    setLoadError(null);

    const load = async (initial: boolean) => {
      try {
        const data = await conversationAPI.get(conversationId, token, initial ? undefined : lastIdRef.current);
        if (!active) return;
        setConversation(data);
        if (!dirtyRef.current) setTopics(data.topics as Topic[]);
        if (data.messages.length > 0) {
          lastIdRef.current = data.messages[data.messages.length - 1].id;
          setMessages((prev) => (initial ? data.messages.map(toUiMessage) : [...prev, ...data.messages.map(toUiMessage)]));
        }
      } catch (err) {
        if (active && initial) setLoadError(getErrorMessage(err, "Não foi possível abrir a negociação."));
      }
    };

    load(true);
    const timer = setInterval(() => load(false), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen, conversationId, token]);

  // manter scroll no fim ao adicionar mensagens
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // reset quando abrir/fechar modal (opcional)
  useEffect(() => {
    if (!isOpen) {
      // limpa confirmação e expandido ao fechar
      setConfirming(null);
      setExpandedTopic(null);
    }
  }, [isOpen]);

  // Esc fecha
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  /* ---------------------------- helpers ---------------------------------- */

  async function refreshMessages() {
    if (!conversationId) return;
    const data = await conversationAPI.get(conversationId, token, lastIdRef.current);
    setConversation(data);
    if (data.messages.length > 0) {
      lastIdRef.current = data.messages[data.messages.length - 1].id;
      setMessages((prev) => [...prev, ...data.messages.map(toUiMessage)]);
    }
  }

  function saveTopics(next: Topic[], note?: string, immediate = false) {
    if (!conversationId || !isOpenNegotiation) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const run = async () => {
      try {
        await conversationAPI.updateTopics(conversationId, next, token, note);
        dirtyRef.current = false;
        if (note) await refreshMessages();
      } catch (err) {
        showToast(getErrorMessage(err, "Não foi possível salvar o tópico."), "error");
      }
    };
    if (immediate) run();
    else saveTimer.current = setTimeout(run, 800);
  }

  function updateTopic(key: TopicKey, patch: Partial<Topic>) {
    const next = topics.map((t) => (t.key === key ? { ...t, ...patch } : t));
    setTopics(next);
    // mudança de estado salva na hora (e avisa no chat); digitação espera uma pausa
    saveTopics(next, patch.state ? `"${keyToLabel(key)}" marcado como ${patch.state}.` : undefined, !!patch.state);
  }

  async function sendMessage(_sender: "prestador" | "cliente" | "system", text: string, attachment?: File) {
    if (!conversationId) return;
    setSending(true);
    try {
      await conversationAPI.send(conversationId, text, token, attachment);
      await refreshMessages();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível enviar a mensagem."), "error");
    } finally {
      setSending(false);
    }
  }

  // enviar resumo de alteração do tópico para o chat (Propor alteração)
  function proposeChange(key: TopicKey, summary: string) {
    const next = topics.map((t) => (t.key === key ? { ...t, state: "Pendente" as TopicState, content: summary } : t));
    setTopics(next);
    saveTopics(next, `Proposta de alteração em "${keyToLabel(key)}": ${summary || "(vazio)"}`, true);
    setExpandedTopic(key);
  }

  function keyToLabel(k: TopicKey) {
    const t = topics.find((x) => x.key === k);
    return t?.label ?? k;
  }

  /* ---------------------------- finalização/encerrar ---------------------- */

  const allAgreed = topics.length > 0 && topics.every((t) => t.state === "Acordado");

  async function handleFormalize() {
    if (!conversationId) return;
    try {
      const result = await conversationAPI.formalize(conversationId, token);
      await refreshMessages();
      showToast(`Serviço formalizado. Contrato ${result.code} gerado.`, "success");
      onFormalize?.(result);
      setTimeout(() => {
        setConfirming(null);
        onClose();
        navigate(`/contract/${result.contractId}`);
      }, 900);
    } catch (err) {
      setConfirming(null);
      showToast(getErrorMessage(err, "Não foi possível formalizar."), "error");
    }
  }

  async function handleCloseNegotiation() {
    if (!conversationId) return;
    try {
      await conversationAPI.close(conversationId, token);
      await refreshMessages();
      setTimeout(() => {
        setConfirming(null);
        onClose();
      }, 900);
    } catch (err) {
      setConfirming(null);
      showToast(getErrorMessage(err, "Não foi possível encerrar."), "error");
    }
  }

  /* ==========================================================================
     SECTION: Render UI
     - Estruturado com sub-areas:
       - header (ícones tópicos)
       - left: painel tópicos expandido (ou área central)
       - right/bottom: chat sempre visível
     - Em mobile, ocupa tela inteira; em desktop, flutua canto inferior direito.
     ========================================================================= */

  if (!isOpen || !conversationId) return null;

  return (
    <AnimatePresence>
      {/* backdrop */}
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dim background */}
        <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

        {/* Main container: mobile = full screen, desktop = small window bottom-right */}
        <motion.div
          initial={isMobile ? { y: 50, opacity: 0 } : { scale: 0.9, opacity: 0, y: 50 }}
          animate={isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
          exit={isMobile ? { y: 50, opacity: 0 } : { scale: 0.9, opacity: 0, y: 50 }}
          transition={{ duration: 0.28, type: "spring", stiffness: 250 }}
          // positioning responsive
          className={`fixed z-60 ${isMobile ? "inset-0 " : "right-6 bottom-6"} `}
        >
          <div
            // container card
            className={`flex ${isMobile ? "flex-col h-screen" : "flex-row"} w-full ${isMobile ? "" : "max-w-[920px]"} bg-[var(--bg-light)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border)]`}
            // evitar scroll horizontal
            style={{ minHeight: isMobile ? "100vh" : "520px", width: isMobile ? "100vw" : undefined }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ------------------------- LEFT / TOP: Tópicos (ícones) ------------------------- */}
            <div className={`flex ${isMobile ? "flex-row items-center px-4 py-2  overflow-x-auto" : "flex-col w-24 p-2 gap-4"} bg-[var(--bg)] border-r border-[var(--border)]`}>
              {/* Close button (mobile) */}
              <div className="flex justify-between items-center w-full mb-1">
                <button onClick={onClose} aria-label="Fechar negociação" className={`${isMobile ? "fixed" : ""} text-[var(--text-muted)] hover:text-[var(--primary)] p-1`}>
                  <X size={20} />
                </button>
              </div>

               {/* icons */}
                {topics.map((t) => {
                const isExpanded = expandedTopic === t.key;
                return (
                    <div key={t.key} className={`group ${isMobile ? "min-w-[80px] " : ""}`}>
                    <button
                        onClick={() => {
                        // toggle expand
                        setExpandedTopic((prev) => (prev === t.key ? null : t.key));
                        }}
                        className={`flex items-center gap-3 w-full p-2 rounded-lg transition ${
                        isExpanded ? "bg-[var(--highlight)]/10" : "hover:bg-[var(--highlight)]/5"
                        }`}
                    >
                        <div
                        className={`w-15 h-15 rounded-md flex items-center justify-center ${stateColor(t.state)}`}
                        >
                        {/* ícone simplificado pela label */}
                        {t.key === "service" && <MessageSquare stroke="white" size={18} />}
                        {t.key === "payment" && <DollarSign stroke="white" size={18} />}
                        {t.key === "start" && <Calendar stroke="white" size={18} />}
                        {t.key === "duration" && <Timer stroke="white" size={18} />}
                        {t.key === "finalize" && <Handshake stroke="white" size={18} />}
                        </div>

                        {/* desktop: mostra label e content apenas se expandido / mobile: nunca mostra */}
                        {!isMobile && isExpanded && (
                        <div className="flex-1 absolute max-w-40 h-auto p-3 rounded-xl text-wrap bg-[var(--bg)] -left-39.5 border-1 border-r-0 border-[var(--border)] text-left">
                            <div className="text-sm text-[var(--text)] font-medium">{t.label}</div>
                            <div className="text-xs text-wrap text-[var(--text-muted)] truncate">
                            {t.tooltip || "Não definido"}
                            </div>
                        </div>
                        )}
                    </button>

                   
                    </div>
                );
                })}

            </div>

            {/* ------------------------- MIDDLE: Expanded topic content ------------------------- */}
            <div className="flex-1 p-4 flex flex-col gap-3">
              {/* Header area (service summary) */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">
                    {conversation?.service?.title || initialService?.title || "Negociação do Serviço"}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {counterpart ? <>Negociando com <strong className="text-[var(--text)]">{counterpart}</strong>. </> : null}
                    {loadError
                      ? loadError
                      : conversation && !isOpenNegotiation
                        ? conversation.status === "FORMALIZED"
                          ? "Negociação formalizada."
                          : "Negociação encerrada."
                        : "Use o chat para alinhar cada tópico. Alterações podem ser propostas e serão enviadas ao chat."}
                    {conversation?.contractId && (
                      <button onClick={() => { onClose(); navigate(`/contract/${conversation.contractId}`); }} className="ml-1 text-[var(--primary)] underline">
                        Ver contrato
                      </button>
                    )}
                  </p>
                </div>

                {/* quick actions: attachments preview */}
                <div className="flex items-center gap-3">
                  <label className={`flex items-center gap-2 text-sm text-[var(--text-muted)] ${isOpenNegotiation ? "cursor-pointer" : "opacity-50 pointer-events-none"}`}>
                    <Paperclip size={16} />
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        // cada arquivo vira uma mensagem com anexo
                        Array.from(files).forEach((file) => sendMessage(myRole, "", file));
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    Anexos
                  </label>
                </div>
              </div>

              {/* Conteúdo do tópico expandido (se houver) */}
              <div className="flex-1 overflow-y-auto p-2">
                <AnimatePresence mode="wait">
                  {expandedTopic ? (
                    <motion.div
                      key={expandedTopic}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                    >
                      {/* Renderiza um formulário inteligente por tópico */}
                      {(() => {
                        const t = topics.find((x) => x.key === expandedTopic)!;
                        switch (t.key) {
                          case "service":
                            return (
                              <>
                                <label className="flex flex-col mb-2">
                                  <span className="text-[var(--text-muted)] text-sm">Título / Resumo</span>
                                  <input
                                    value={t.content}
                                    onChange={(e) => updateTopic(t.key, { content: e.target.value })}
                                    placeholder="Resuma o serviço aqui (ex: Design de logo + 2 revisões)"
                                    className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)]"
                                  />
                                </label>

                                <label className="flex flex-col mb-2">
                                  <span className="text-[var(--text-muted)] text-sm">Descrição detalhada</span>
                                  <textarea
                                    value={t.content}
                                    onChange={(e) => updateTopic(t.key, { content: e.target.value })}
                                    placeholder="Descreva o escopo, entregáveis e limites..."
                                    rows={4}
                                    className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)] resize-none"
                                  />
                                </label>

                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => updateTopic(t.key, { state: "Acordado" })}
                                    className="px-1 md:px-3 py-1 rounded bg-green-500/20 text-green-600 hover:bg-green-500/30"
                                  >
                                    Acordado
                                  </button>
                                  <button
                                    onClick={() => updateTopic(t.key, { state: "Pendente" })}
                                    className="px-1 md:px-3 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)]/90 hover:bg-[var(--primary)]/40"
                                  >
                                    Pendente
                                  </button>
                                  <button
                                    onClick={() => updateTopic(t.key, { state: "Negado" })}
                                    className="px-1 md:px-3 py-1 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30"
                                  >
                                    Negado
                                  </button>

                                  <button
                                    onClick={() => proposeChange(t.key, t.content)}
                                    className="ml-auto px-1 md:px-3 py-1 rounded bg-[var(--highlight)] text-black hover:brightness-105"
                                  >
                                    Propor alteração
                                  </button>
                                </div>
                              </>
                            );
                          case "payment":
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="flex flex-col">
                                    <span className="text-[var(--text-muted)] text-sm">Valor (R$)</span>
                                    <input
                                      value={extractAmount(t.content)}
                                      onChange={(e) => updateTopic(t.key, { content: `${e.target.value} • ${extractPaymentMethod(t.content)}` })}
                                      placeholder="Ex: 250.00"
                                      className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)]"
                                    />
                                  </label>

                                  <label className="flex flex-col">
                                    <span className="text-[var(--text-muted)] text-sm">Método de pagamento</span>
                                    <input
                                      value={extractPaymentMethod(t.content)}
                                      onChange={(e) => updateTopic(t.key, { content: `${extractAmount(t.content)} • ${e.target.value}` })}
                                      placeholder="Ex: Pix, Transferência, Cartão"
                                      className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)]"
                                    />
                                  </label>
                                </div>

                                <div className="flex gap-2 mt-3">
                                  <button onClick={() => updateTopic(t.key, { state: "Acordado" })} className="px-1 md:px-3 py-1 rounded bg-green-500/20 text-green-600 hover:bg-green-500/30">Acordado</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Pendente" })} className="px-1 md:px-3 py-1 rounded bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">Pendente</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Negado" })} className="px-1 md:px-3 py-1 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30">Negado</button>

                                  <button onClick={() => proposeChange(t.key, t.content)} className="ml-auto px-1 md:px-3 py-1 rounded bg-[var(--highlight)] text-black hover:brightness-105">Propor alteração</button>
                                </div>
                              </>
                            );
                          case "start":
                            return (
                              <>
                                <label className="flex flex-col">
                                  <span className="text-[var(--text-muted)] text-sm">Data e hora</span>
                                  <input
                                    type="datetime-local"
                                    value={t.content}
                                    onChange={(e) => updateTopic(t.key, { content: e.target.value })}
                                    className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)]"
                                  />
                                </label>

                                <div className="flex gap-2 mt-3">
                                  <button onClick={() => updateTopic(t.key, { state: "Acordado" })} className="px-1 md:px-3 py-1 rounded bg-green-500/20 text-green-600 hover:bg-green-500/30">Acordado</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Pendente" })} className="px-1 md:px-3 py-1 rounded bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">Pendente</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Negado" })} className="px-1 md:px-3 py-1 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30">Negado</button>

                                  <button onClick={() => proposeChange(t.key, t.content)} className="ml-auto px-1 md:px-3 py-1 rounded bg-[var(--highlight)] text-black hover:brightness-105">Propor alteração</button>
                                </div>
                              </>
                            );
                          case "duration":
                            return (
                              <>
                                <label className="flex flex-col">
                                  <span className="text-[var(--text-muted)] text-sm">Duração estimada</span>
                                  <input
                                    placeholder="Ex: 02:00 (hh:mm) ou '3 dias'"
                                    value={t.content}
                                    onChange={(e) => updateTopic(t.key, { content: e.target.value })}
                                    className="mt-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded text-[var(--text)]"
                                  />
                                </label>

                                <div className="flex gap-2 mt-3">
                                  <button onClick={() => updateTopic(t.key, { state: "Acordado" })} className="px-1 md:px-3 py-1 rounded bg-green-500/20 text-green-600 hover:bg-green-500/30">Acordado</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Pendente" })} className="px-1 md:px-3 py-1 rounded bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">Pendente</button>
                                  <button onClick={() => updateTopic(t.key, { state: "Negado" })} className="px-1 md:px-3 py-1 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30">Negado</button>

                                  <button onClick={() => proposeChange(t.key, t.content)} className="ml-auto px-1 md:px-3 py-1 rounded bg-[var(--highlight)] text-black hover:brightness-105">Propor alteração</button>
                                </div>
                              </>
                            );
                          case "finalize":
                            return (
                              <>
                                <p className="text-[var(--text-muted)]">Neste tópico você pode formalizar ou encerrar a negociação. Formalizar fica disponível apenas quando todos os tópicos estiverem marcados como "Acordado".</p>

                                <div className="flex gap-2 mt-4">
                                  <button
                                    onClick={() => setConfirming("close")}
                                    disabled={!isOpenNegotiation}
                                    className="px-1 md:px-3 py-2 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30 disabled:opacity-50"
                                  >
                                    Encerrar negociação
                                  </button>

                                  <button
                                    disabled={!allAgreed || !isOpenNegotiation}
                                    onClick={() => setConfirming("formalize")}
                                    className={`px-1 md:px-3 py-2 rounded font-semibold ${allAgreed && isOpenNegotiation ? "bg-green-500/20 text-green-600 hover:bg-green-500/30" : "bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"}`}
                                  >
                                    Formalizar Serviço
                                  </button>

                                  {/* botão para enviar resumo pro chat */}
                                  <button
                                    onClick={() => {
                                      sendMessage(myRole, `Pedido de formalização: ${allAgreed ? "todos os tópicos estão acordados" : "ainda há tópicos pendentes"}.`);
                                    }}
                                    className="ml-auto px-1 md:px-3 py-2 rounded bg-[var(--highlight)] text-black hover:brightness-105"
                                  >
                                    Enviar resumo ao chat
                                  </button>
                                </div>
                              </>
                            );
                          default:
                            return null;
                        }
                      })()}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[var(--text-muted)]">
                      Selecione um tópico para editar e propor alterações.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ------------------------- BOTTOM: Chat (sempre visível) ------------------------- */}
              <div className="border-t  border-[var(--border)] pt-3">
                <div ref={chatScrollRef} className="max-h-100 md:max-h-86 overflow-y-auto space-y-2 px-2 pb-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === myRole ? "justify-end" : m.sender === "system" ? "justify-center" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-lg ${m.sender === myRole ? "bg-[var(--primary)] text-white" : m.sender === "system" ? "bg-[var(--bg-dark)]/70 text-[var(--text-muted)]" : "bg-[var(--bg)] text-[var(--text)]"} `}>
                        {m.sender !== "system" && m.sender !== myRole && (
                          <div className="text-xs font-semibold mb-0.5 opacity-80">{m.sender === "prestador" ? "Prestador" : "Cliente"}</div>
                        )}
                        {m.attachmentUrl && (
                          <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline mb-1">
                            <FileText size={14} /> {m.attachmentName || "Anexo"}
                          </a>
                        )}
                        <div className="text-sm">{m.text}</div>
                        <div className={`text-xs text-right mt-1 ${m.sender === myRole ? "text-white/70" : "text-[var(--text-muted)]"}`}>{m.time}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* input do chat */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim() || sending || !isOpenNegotiation) return;
                    sendMessage(myRole, chatInput.trim());
                    setChatInput("");
                  }}
                  className="mt-2 flex items-center gap-2"
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={isOpenNegotiation ? "Digite sua mensagem..." : "Negociação encerrada"}
                    disabled={!isOpenNegotiation}
                    aria-label="Mensagem"
                    className="flex-1 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                  />
                  <button type="submit" aria-label="Enviar mensagem" disabled={sending || !isOpenNegotiation} className="px-3 py-2 rounded bg-[var(--primary)] text-white disabled:opacity-60">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Confirmação animada (overlay) */}
          <AnimatePresence>
            {confirming === "formalize" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center z-50">
                <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }} className="bg-[var(--bg)] p-6 rounded-lg shadow-lg border border-[var(--border)] text-center">
                  
                  <CheckCircle size={40} className="mx-auto text-green-500" />
                  <p className="mt-3 text-[var(--text)] font-semibold">Confirmar formalização?</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <button onClick={() => setConfirming(null)} className="px-3 py-2 rounded bg-[var(--border)] text-[var(--text-muted)]">Cancelar</button>
                    <button onClick={handleFormalize} className="px-3 py-2 rounded bg-green-500 text-white">Confirmar</button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {confirming === "close" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center z-50">
                <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }} className="bg-[var(--bg)] p-6 rounded-lg shadow-lg border border-[var(--border)] text-center">
                  <XCircle size={40} className="mx-auto text-red-500" />
                  <p className="mt-3 text-[var(--text)] font-semibold">Encerrar negociação?</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <button onClick={() => setConfirming(null)} className="px-3 py-2 rounded bg-[var(--border)] text-[var(--text-muted)]">Cancelar</button>
                    <button onClick={handleCloseNegotiation} className="px-3 py-2 rounded bg-red-500 text-white">Confirmar</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ==========================================================================
   SECTION: Small helpers used above
   - extractAmount / extractPaymentMethod: helpers simples para separar valor • método
   ========================================================================= */

function extractAmount(s: string) {
  if (!s) return "";
  const parts = s.split("•").map((p) => p.trim());
  // se primeiro for número-like, retorna
  return parts[0] || "";
}

function extractPaymentMethod(s: string) {
  if (!s) return "";
  const parts = s.split("•").map((p) => p.trim());
  return parts[1] || "";
}
