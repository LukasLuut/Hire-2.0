import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveEvent, liveConnected } from "../../utils/liveEvents";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  PenTool,
  ShieldCheck,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";
import { conversationAPI } from "../../api/ConversationAPI";
import { providerApi } from "../../api/ProviderAPI";
import type { ChatMessage, ConversationDetail, NegotiationTopic } from "../../interfaces/Entities";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency } from "../../utils/format";
import { uploadUrl } from "../../utils/avatar";

/*
  NegotiationFlow.tsx
  -------------------
  - Sala de negociação de uma conversa real (rota /negotiation/:id)
  - Contém 4 etapas: Preview -> Negociação -> Resumo -> Confirmação.
  - Cada item do acordo é um tópico da negociação: quem muda o valor propõe,
    e só a outra parte pode aceitar. Quando as duas partes aceitam o acordo,
    a contratação e o contrato são gerados.
*/

type Role = "cliente" | "prestador";

type Party = {
  id: Role;
  name: string;
  title?: string;
  rating?: number;
};

type Message = {
  id: string;
  sender: "provider" | "client" | "system";
  text: string;
  time: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

type AgreementStatus = "agreed" | "proposed" | "pending" | "denied";

type AgreementCard = {
  key: string;
  title: string;
  value: string;
  status: AgreementStatus;
  proposedBy?: Role | null;
};

// reserva: mensagens chegam em tempo real; sem conexão ao vivo, confere a cada 4 s
const POLL_MS = 4000;
const POLL_LIVE_MS = 30_000;
const WARRANTY_KEY = "warranty";

function toMessage(m: ChatMessage): Message {
  return {
    id: String(m.id),
    sender: m.role === "cliente" ? "client" : m.role === "prestador" ? "provider" : "system",
    text: m.text,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    attachmentUrl: uploadUrl(m.attachmentUrl),
    attachmentName: m.attachmentName,
  };
}

function toCard(t: NegotiationTopic): AgreementCard {
  const hasValue = !!t.content?.trim();
  return {
    key: t.key,
    title: t.label,
    value: hasValue ? t.content : "—",
    status: t.state === "Acordado" ? "agreed" : t.state === "Negado" ? "denied" : hasValue ? "proposed" : "pending",
    proposedBy: t.proposedBy ?? null,
  };
}

const statusColor = (s: AgreementStatus) =>
  s === "agreed" ? "text-green-400" : s === "proposed" ? "text-amber-400" : s === "denied" ? "text-red-400" : "text-[var(--text-muted)]";

export default function NegotiationFlow() {
  const { id } = useParams();
  const conversationId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const token = localStorage.getItem("token") ?? "";

  const [step, setStep] = useState(0); // 0..3
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [topics, setTopics] = useState<NegotiationTopic[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providerRating, setProviderRating] = useState<{ average: number; count: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastIdRef = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState<{ key: string | null; value: string; label?: string } | null>(null);

  const myRole: Role = conversation?.myRole === "prestador" ? "prestador" : "cliente";
  const isOpen = conversation?.status === "OPEN";
  const providerName = conversation?.provider?.companyName || conversation?.provider?.professionalName || "Prestador";
  const clientName = conversation?.client?.name ?? "Cliente";
  const otherName = myRole === "cliente" ? providerName : clientName;

  const provider: Party = { id: "prestador", name: providerName, title: "Prestador", rating: providerRating?.average };
  const client: Party = { id: "cliente", name: clientName, title: "Cliente" };

  /* ----------------------------- dados ----------------------------- */
  const load = useCallback(
    async (initial: boolean) => {
      if (!conversationId || !token) return;
      try {
        const data = await conversationAPI.get(conversationId, token, initial ? undefined : lastIdRef.current);
        setConversation(data);
        setTopics(data.topics);
        if (data.messages.length) {
          lastIdRef.current = data.messages[data.messages.length - 1].id;
          setMessages((prev) => (initial ? data.messages.map(toMessage) : [...prev, ...data.messages.map(toMessage)]));
        }
      } catch (err) {
        if (initial) setLoadError(getErrorMessage(err, "Negociação não encontrada."));
      }
    },
    [conversationId, token]
  );

  useEffect(() => {
    lastIdRef.current = 0;
    load(true);
    // com a conexão ao vivo aberta, o polling só roda a cada 30 s
    let last = Date.now();
    const timer = setInterval(() => {
      if (liveConnected() && Date.now() - last < POLL_LIVE_MS) return;
      last = Date.now();
      load(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // mensagem ou mudança nesta negociação: busca só o que é novo
  useLiveEvent((e) => {
    if (e.type === "conversation" && e.id === conversationId) load(false);
  });

  const providerId = conversation?.provider?.id;
  useEffect(() => {
    if (!providerId) return;
    providerApi.getPublic(providerId).then((p) => setProviderRating(p.rating ?? null)).catch(() => {});
  }, [providerId]);

  // conversa já formalizada: vai direto para a confirmação
  useEffect(() => {
    if (conversation?.status === "FORMALIZED") setStep(3);
  }, [conversation?.status]);

  const cards = useMemo(() => topics.filter((t) => t.key !== "finalize").map(toCard), [topics]);
  const progress = useMemo(() => Math.round(((step + 1) / 4) * 100), [step]);

  /* ----------------------------- ações ----------------------------- */
  async function saveTopics(next: NegotiationTopic[], note?: string) {
    setBusy(true);
    try {
      const saved = await conversationAPI.updateTopics(conversationId, next, token, note);
      setTopics(saved.topics);
      setConversation((c) => (c ? { ...c, ...saved } : c));
      await load(false);
      return true;
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível atualizar o acordo."), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addMessage(text: string, file?: File) {
    try {
      await conversationAPI.send(conversationId, text, token, file);
      await load(false);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível enviar."), "error");
    }
  }

  function proposeChange(key: string, value: string, label?: string) {
    const exists = topics.some((t) => t.key === key);
    const next: NegotiationTopic[] = exists
      ? topics.map((t) => (t.key === key ? { ...t, content: value, state: "Pendente" } : t))
      : [
          ...topics.filter((t) => t.key !== "finalize"),
          { key, label: label ?? key, state: "Pendente", content: value },
          ...topics.filter((t) => t.key === "finalize"),
        ];
    const title = label ?? topics.find((t) => t.key === key)?.label ?? key;
    return saveTopics(next, `${myRole === "cliente" ? "Cliente" : "Prestador"} propôs alteração em ${title}: ${value}`);
  }

  function acceptCard(key: string) {
    const title = topics.find((t) => t.key === key)?.label ?? key;
    return saveTopics(
      topics.map((t) => (t.key === key ? { ...t, state: "Acordado" } : t)),
      `${myRole === "cliente" ? "Cliente" : "Prestador"} aceitou ${title}.`
    );
  }

  async function acceptAgreement() {
    setBusy(true);
    try {
      const result = await conversationAPI.accept(conversationId, token);
      await load(false);
      if (result.formalized) showToast(`Acordo fechado! Contrato ${result.code} gerado.`, "success");
      else showToast(`Seu aceite foi registrado. Falta ${otherName} aceitar.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível aceitar o acordo."), "error");
    } finally {
      setBusy(false);
    }
  }

  function canProceedToSummary() {
    // pode revisar quando nenhum item está vazio ou negado
    return cards.length > 0 && cards.every((c) => c.status === "agreed" || c.status === "proposed");
  }

  function allAgreed() {
    return cards.length > 0 && cards.every((c) => c.status === "agreed");
  }

  const firstOpenCard = cards.find((c) => c.status !== "agreed") ?? cards[0];
  const openEditor = (key: string) => {
    const t = topics.find((x) => x.key === key);
    setEditing({ key, value: t?.content ?? "", label: t?.label });
  };

  if (loadError) {
    return (
      <div className="min-h-screen pt-32 text-center bg-[var(--bg-dark)] text-[var(--text)]">
        <p className="text-xl font-semibold">{loadError}</p>
        <button onClick={() => navigate("/home")} className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white">Voltar ao início</button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen pt-32 flex justify-center bg-[var(--bg-dark)]">
        <Loader2 className="animate-spin text-[var(--text-muted)]" aria-label="Carregando negociação" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen lg:h-screen pt-20 text-[var(--text)] bg-[var(--bg-dark)]">
     {/* Main grid */}
      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">


        {/* Center column: steps */}
        <main className="flex-1 px-4 pb-4 pt-24 md:px-6 lg:pt-6 lg:pl-28 lg:overflow-auto">
          {!isOpen && (
            <div className="max-w-4xl mx-auto mb-4 p-3 rounded-xl border border-[var(--bg-light)]/40 text-sm text-[var(--text-muted)]">
              {conversation.status === "FORMALIZED"
                ? "Negociação formalizada — o contrato já foi gerado."
                : conversation.requestStatus === "RECUSADA"
                  ? `Pedido recusado pelo prestador.${conversation.rejectReason ? ` Motivo: ${conversation.rejectReason}` : ""}`
                  : `${conversation.closedBy === "cliente" && conversation.requestStatus === "RESPONDIDA" ? "Proposta recusada pelo cliente" : conversation.closedBy ? `Negociação encerrada pelo ${conversation.closedBy}` : "Negociação encerrada"}.${conversation.closeReason ? ` Motivo: ${conversation.closeReason}` : ""}`}
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Step1ServicePreview
                  conversation={conversation}
                  provider={provider}
                  ratingCount={providerRating?.count ?? 0}
                  onNext={() => setStep(1)}
                />
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Step2Negotiation
                  messages={messages}
                  onSend={(text) => addMessage(text)}
                  myRole={myRole}
                  provider={provider}
                  client={client}
                  cards={cards}
                  disabled={!isOpen || busy}
                  onPropose={openEditor}
                  acceptCard={acceptCard}
                  onBack={() => setStep(0)}
                  onNext={() => setStep(2)}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Step3AgreementSummary
                  cards={cards}
                  myRole={myRole}
                  otherName={otherName}
                  disabled={!isOpen}
                  onEdit={openEditor}
                  allAgreed={allAgreed()}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Step4Confirmation
                  cards={cards}
                  conversation={conversation}
                  provider={provider}
                  client={client}
                  myRole={myRole}
                  busy={busy}
                  onSign={acceptAgreement}
                  onBack={() => setStep(2)}
                  onOpenContract={() => conversation.contractId && navigate(`/contract/${conversation.contractId}`)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right column: live summary / actions */}
        <aside className="w-full lg:w-96 p-4 md:p-6 border-t lg:border-t-0 lg:border-l border-[var(--bg-light)] bg-[var(--bg-dark)]/20 flex flex-col gap-6">
           {/* Barra de Progresso  */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-48 h-3 bg-[var(--bg-light)] rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da negociação">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
          <div className="rounded-2xl p-4 bg-[var(--bg-light)]/10 border border-[var(--bg-light)]/20 backdrop-blur-md">

            <div className="flex items-start justify-between">

              <div>

                <div className="text-sm text-[var(--text-muted)]">Resumo ao vivo</div>
                <div className="font-semibold text-lg mt-1">Resumo do Acordo</div>
              </div>
              <div className="text-xs text-[var(--text-muted)]">{messages.length} mensagens</div>
            </div>

            <div className="mt-4 space-y-3">
              {cards.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{c.value}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-medium ${statusColor(c.status)}`}>
                      {statusLabel(c, myRole)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 px-4 py-2 rounded-lg border border-[var(--bg-light)]/30 text-sm">Abrir negociação</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToSummary()} className={`px-4 py-2 rounded-lg text-sm font-medium ${canProceedToSummary() ? "bg-blue-600 text-white" : "bg-[var(--bg-light)]/10 text-[var(--text-muted)] cursor-not-allowed"}`}>
                Ver resumo
              </button>
            </div>
          </div>

          <div className="rounded-xl p-4 bg-[var(--bg-light)]/10   border border-[var(--bg-light)]/20">
            <div className="text-sm text-[var(--text-muted)]">Ações rápidas</div>
            <div className="mt-3 flex flex-col gap-2">
              <button disabled={!isOpen || !firstOpenCard} onClick={() => firstOpenCard && openEditor(firstOpenCard.key)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-light)]/10 hover:bg-[var(--bg-light)]/20 disabled:opacity-50"> <PenTool className="w-4 h-4" /> Propor alteração</button>
              <button disabled={!isOpen} onClick={() => setEditing({ key: WARRANTY_KEY, label: "Garantia", value: topics.find((t) => t.key === WARRANTY_KEY)?.content ?? "Garantia de 90 dias para o serviço executado" })} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-light)]/10 hover:bg-[var(--bg-light)]/20 disabled:opacity-50"> <ShieldCheck className="w-4 h-4" /> Solicitar garantia</button>
              <button disabled={!isOpen} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-light)]/10 hover:bg-[var(--bg-light)]/20 disabled:opacity-50"> <Upload className="w-4 h-4" /> Adicionar anexo</button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) addMessage("", file);
                }}
              />
            </div>
          </div>

          <div className="mt-auto text-xs text-[var(--text-muted)]">Histórico e anexos ficam registrados na conversa. {conversation.contractId ? "O contrato está disponível na etapa de confirmação." : ""}</div>
        </aside>
      </div>

      {/* Inline editor modal (simplificado) */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
            <motion.div role="dialog" aria-modal="true" aria-labelledby="edit-title" initial={{ scale: 0.98 }} animate={{ scale: 1 }} exit={{ scale: 0.98 }} className="relative z-50 w-[min(720px,92%)] p-6 rounded-2xl bg-[var(--bg-light)] border border-[var(--bg-light)]/20">
              <div className="flex items-center justify-between">
                <div>
                  <div id="edit-title" className="font-semibold">Editar: {editing.label ?? editing.key}</div>
                  <div className="text-xs text-[var(--text-muted)]">Altere o valor e proponha para {otherName} aceitar.</div>
                </div>
                <button onClick={() => setEditing(null)} aria-label="Fechar" className="text-[var(--text-muted)]"><XCircle /></button>
              </div>

              <div className="mt-4">
                <textarea aria-label={`Novo valor para ${editing.label ?? editing.key}`} maxLength={500} className="w-full h-28 p-3 rounded-lg bg-[var(--bg)] text-[var(--text)] border border-[var(--bg-light)]/20" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-[var(--bg-light)]/20">Cancelar</button>
                <button
                  disabled={busy || !editing.value.trim()}
                  onClick={async () => {
                    if (!editing.key) return;
                    if (await proposeChange(editing.key, editing.value.trim(), editing.label)) setEditing(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                >
                  Propor alteração
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function statusLabel(c: AgreementCard, myRole: Role) {
  if (c.status === "agreed") return "Acordado";
  if (c.status === "denied") return "Negado";
  if (c.status === "pending") return "A definir";
  return c.proposedBy === myRole ? "Proposto por você" : "Aguardando você";
}

/* -------------------------- Subcomponents -------------------------- */

function Step1ServicePreview({ conversation, provider, ratingCount, onNext }: { conversation: ConversationDetail; provider: Party; ratingCount: number; onNext: () => void }) {
  const service = conversation.service;
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl p-6 bg-[var(--bg-light)]/10  border border-[var(--bg-light)]/20 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <div className="text-xs text-[var(--text-muted)]">Serviço publicado por {provider.name}</div>
            <div className="font-semibold text-2xl mt-1">{service?.title ?? "Negociação direta"}</div>
            <div className="text-sm text-[var(--text-muted)] mt-2">{service?.description ?? "Negociação sem serviço publicado."}</div>

            <div className="mt-4 flex items-center gap-4">
              <div className="text-sm">
                <div className="text-[var(--text-muted)]">Prazo base</div>
                <div className="font-medium">{service?.duration || "A combinar"}</div>
              </div>

              <div className="text-sm">
                <div className="text-[var(--text-muted)]">Preço</div>
                <div className="font-medium">{service ? formatCurrency(service.price) : "A combinar"}</div>
              </div>
            </div>

            {conversation.request && (
              <div className="mt-4 text-sm p-3 rounded-lg bg-[var(--bg)] border border-[var(--bg-light)]/10">
                <div className="text-[var(--text-muted)] text-xs mb-1">Pedido de {conversation.client?.name}</div>
                <div>{conversation.request.description}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Orçamento: {conversation.request.budget}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="text-xs text-[var(--text-muted)]">Avaliação</div>
            <div className="font-semibold">{ratingCount > 0 && provider.rating ? `${provider.rating.toFixed(1)}★` : "Novo"}</div>
            <button onClick={onNext} className="mt-4 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-medium">Contratar / Negociar</button>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-[var(--text-muted)]">Você está prestes a iniciar uma negociação. As duas partes podem propor e aceitar alterações — tudo fica registrado.</div>
    </div>
  );
}

function Step2Negotiation({ messages, onSend, myRole, provider, client, cards, disabled, onPropose, acceptCard, onBack, onNext }: {
  messages: Message[];
  onSend: (text: string) => void;
  myRole: Role;
  provider: Party;
  client: Party;
  cards: AgreementCard[];
  disabled: boolean;
  onPropose: (key: string) => void;
  acceptCard: (k: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mine = myRole === "cliente" ? "client" : "provider";
  const other = myRole === "cliente" ? provider : client;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Negociação — {other.name}</div>
          <div className="font-semibold text-xl">Converse e ajuste os termos</div>
        </div>
        <div className="text-sm text-[var(--text-muted)]">Quem propõe não aceita a própria proposta</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chat */}
        <div className="lg:col-span-8">
          <div className="rounded-xl p-4 bg-[var(--bg-light)]/10   border border-[var(--bg-light)]/20 h-[60vh] flex flex-col">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto" aria-live="polite">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === mine ? 'justify-end' : m.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${m.sender === mine ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' : m.sender === 'system' ? 'bg-[var(--bg)] text-[var(--text-muted)] text-center' : 'bg-[var(--bg-light)] text-[var(--text)]'}`}>
                    {m.attachmentUrl && (
                      <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline mb-1">
                        <FileText size={14} /> {m.attachmentName || "Anexo"}
                      </a>
                    )}
                    <div className="text-sm whitespace-pre-line">{m.text}</div>
                    <div className={`text-[10px] mt-1 text-right ${m.sender === mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (text.trim() && !disabled) { onSend(text.trim()); setText(''); } }}
              className="mt-4 flex gap-2"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} aria-label="Mensagem" placeholder={disabled ? "Negociação encerrada" : "Escreva uma mensagem ou proponha algo..."} className="flex-1 min-w-0 px-4 py-2 rounded-lg bg-[var(--bg)] text-[var(--text)] border border-[var(--bg-light)]/20" />
              <button type="submit" disabled={disabled} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">Enviar</button>
            </form>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={onBack} className="px-4 py-2 rounded-lg border border-[var(--bg-light)]/20">Voltar</button>
            <button onClick={onNext} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Resumo</button>
          </div>
        </div>

        {/* Cards */}
        <div className="lg:col-span-4">
          <div className="rounded-xl p-4 bg-[var(--bg-light)]/10   border border-[var(--bg-light)]/20">
            <div className="font-medium">Itens do acordo</div>
            <div className="mt-3 space-y-3">
              {cards.map((c) => {
                const canAccept = !disabled && c.status === "proposed" && c.proposedBy !== myRole;
                return (
                  <div key={c.key} className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--bg-light)]/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.title}</div>
                        <div className="text-xs text-[var(--text-muted)] break-words">{c.value}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-medium ${statusColor(c.status)}`}>{statusLabel(c, myRole)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button disabled={disabled} onClick={() => onPropose(c.key)} className="flex-1 px-3 py-2 rounded-md border border-[var(--bg-light)]/10 text-sm disabled:opacity-50">Propor</button>
                      <button
                        disabled={!canAccept}
                        onClick={() => acceptCard(c.key)}
                        title={c.proposedBy === myRole ? "Aguardando a outra parte aceitar" : undefined}
                        className="px-3 py-2 rounded-md bg-green-600 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3AgreementSummary({ cards, myRole, otherName, disabled, onEdit, allAgreed, onBack, onNext }: {
  cards: AgreementCard[];
  myRole: Role;
  otherName: string;
  disabled: boolean;
  onEdit: (key: string) => void;
  allAgreed: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl p-6 bg-[var(--bg-light)]/10  border border-[var(--bg-light)]/20 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-sm text-[var(--text-muted)]">Resumo do acordo</div>
            <div className="font-semibold text-2xl mt-1">Revisão final dos termos</div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Status: {allAgreed ? 'Tudo acordado' : `Aguardando ajustes com ${otherName}`}</div>
        </div>

        <div className="mt-6 space-y-4">
          {cards.map((c) => (
            <div key={c.key} className="p-4 rounded-lg bg-[var(--bg)] border border-[var(--bg-light)]/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1 break-words">{c.value}</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className={`text-xs font-medium ${statusColor(c.status)}`}>{statusLabel(c, myRole)}</div>
                <div className="flex gap-2">
                  <button disabled={disabled} onClick={() => onEdit(c.key)} className="text-sm px-3 py-1 rounded-md border border-[var(--bg-light)]/10 disabled:opacity-50">Editar</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border border-[var(--bg-light)]/20">Voltar</button>
          <div>
            <button onClick={onNext} disabled={!allAgreed} className={`px-4 py-2 rounded-lg ${allAgreed ? 'bg-blue-600 text-white' : 'bg-[var(--bg-light)]/10 text-[var(--text-muted)] cursor-not-allowed'}`}>Prosseguir para assinatura</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Confirmation({ cards, conversation, provider, client, myRole, busy, onSign, onBack, onOpenContract }: {
  cards: AgreementCard[];
  conversation: ConversationDetail;
  provider: Party;
  client: Party;
  myRole: Role;
  busy: boolean;
  onSign: () => void;
  onBack: () => void;
  onOpenContract: () => void;
}) {
  const signed = { provider: !!conversation.providerAcceptedAt, client: !!conversation.clientAcceptedAt };
  const formalized = conversation.status === "FORMALIZED";
  const isOpen = conversation.status === "OPEN";

  const SignRow = ({ party, done }: { party: Party; done: boolean }) => (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium">{party.title}</div>
        <div className="text-xs text-[var(--text-muted)]">{party.name}</div>
      </div>
      <div>
        {done || formalized ? (
          <div className="text-green-400 font-medium flex items-center gap-2"><CheckCircle /> Aceito</div>
        ) : party.id === myRole ? (
          <button onClick={onSign} disabled={busy || !isOpen} className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60">Aceitar acordo</button>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">Aguardando</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl p-6 bg-[var(--bg-light)]/10  border border-[var(--bg-light)]/20 backdrop-blur-md">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm text-[var(--text-muted)]">Confirmação</div>
            <div className="font-semibold text-2xl mt-1">Aceite e confirmação final</div>
            <div className="text-sm text-[var(--text-muted)] mt-3">Quando as duas partes aceitarem, o contrato é gerado para assinatura.</div>
          </div>

          <div className="text-right">
            <div className="text-sm text-[var(--text-muted)]">Progresso</div>
            <div className="font-semibold text-lg mt-1">{formalized ? 'Contrato gerado' : 'Pendente'}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 p-4 rounded-lg bg-[var(--bg)] border border-[var(--bg-light)]/10">
            <div className="font-medium">Resumo do acordo</div>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              {cards.map(c => (
                <div key={c.key} className="flex justify-between gap-3">
                  <div>{c.title}</div>
                  <div className="font-medium text-right break-words min-w-0">{c.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-1 p-4 rounded-lg bg-[var(--bg)] border border-[var(--bg-light)]/10 flex flex-col justify-between">
            <div>
              <div className="text-sm text-[var(--text-muted)]">Aceites</div>
              <div className="mt-3 space-y-3">
                <SignRow party={provider} done={signed.provider} />
                <SignRow party={client} done={signed.client} />
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={onBack} disabled={formalized} className="px-4 py-2 rounded-lg border border-[var(--bg-light)]/20 disabled:opacity-50">Voltar</button>
              <div>
                <button onClick={onOpenContract} disabled={!formalized} className={`px-4 py-2 rounded-lg ${formalized ? 'bg-green-600 text-white' : 'bg-[var(--bg-light)]/10 text-[var(--text-muted)] cursor-not-allowed'}`}>Ver contrato</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
