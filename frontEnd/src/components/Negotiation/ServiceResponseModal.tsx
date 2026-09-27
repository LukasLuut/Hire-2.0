import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, FileText, Upload, Send, XCircle } from "lucide-react";
import { SmallTooltip } from "./ServiceNegotiationModal";
import RejectProposalModal from "./RejectProposalModal";
import { conversationAPI } from "../../api/ConversationAPI";
import type { ConversationDetail } from "../../interfaces/Entities";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { uploadUrl } from "../../utils/avatar";

interface Service {
  id?: number;
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
  price?: string;
  deliveryTime?: string;
  attachments?: File[];
}

export interface ClientProposal {
  clientName: string;
  serviceTitle: string;
  serviceDescription: string;
  budget: string;
  date: string;
  notes?: string;
  files: { url: string; name: string }[];
}

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d.length === 10 ? d + "T00:00:00" : d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("pt-BR");
}

/** Pedido do cliente como está salvo na negociação (texto, orçamento e anexos que ele enviou). */
function toProposal(c: ConversationDetail): ClientProposal {
  return {
    clientName: c.client?.name ?? "Cliente",
    serviceTitle: c.service?.title ?? "",
    serviceDescription: c.request?.description ?? "",
    budget: c.request?.budget ?? "",
    date: formatDate(c.request?.date ?? ""),
    notes: c.request?.notes ?? "",
    files: c.messages
      .filter((m) => m.role === "cliente" && m.attachmentUrl)
      .map((m) => ({ url: uploadUrl(m.attachmentUrl)!, name: m.attachmentName ?? "Anexo" })),
  };
}

/* --------------------------------------------------------------------------
 * MODAL DE RESPOSTA DO PRESTADOR
 * -------------------------------------------------------------------------- */
export default function ServiceResponseModal({
  isOpen,
  onClose,
  conversationId,
  negotiationId,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number | null;
  /** negociação do pedido dentro da conversa (sem ela, vale a aberta em destaque) */
  negotiationId?: number | null;
  /** chamado depois de responder ou recusar (para atualizar a lista do painel) */
  onDone?: () => void;
}) {
  const { showToast } = useToast();
  const [clientProposal, setClientProposal] = useState<ClientProposal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [service, setService] = useState<Service>({
    title: "",
    description: "",
    price: "",
    deliveryTime: "",
    attachments: [],
  });

  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const token = localStorage.getItem("token") ?? "";

  // carrega o pedido do cliente e sugere a resposta a partir dele
  useEffect(() => {
    if (!isOpen || !conversationId) return;
    let active = true;
    setSent(false);
    setLoadError(null);
    setClientProposal(null);
    conversationAPI
      .get(conversationId, token)
      .then((conv) => {
        if (!active) return;
        // a conversa pode ter várias negociações: usa a do pedido
        const n = negotiationId ? conv.negotiations.find((x) => x.id === negotiationId) : null;
        const c = n ? { ...conv, service: n.service, request: n.request, requestStatus: n.requestStatus, topics: n.topics } : conv;
        const proposal = toProposal(c);
        setClientProposal(proposal);
        setService({
          title: proposal.serviceTitle || `Proposta para ${proposal.clientName}`,
          description: proposal.serviceDescription,
          price: proposal.budget,
          deliveryTime: c.service?.duration ?? "",
          attachments: [],
        });
      })
      .catch((err) => active && setLoadError(getErrorMessage(err, "Não foi possível carregar o pedido.")));
    return () => {
      active = false;
    };
  }, [isOpen, conversationId, negotiationId, token]);

  // Esc fecha (quando a confirmação de recusa não está aberta)
  useEffect(() => {
    if (!isOpen || rejectOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, rejectOpen, onClose]);

  if (!isOpen || !conversationId) return null;
  const handleRefuse=()=>{
    setRejectOpen(true);
  }

  const handleSend = async () => {
    if (!service.description.trim() || !String(service.price ?? "").trim()) {
      showToast("Informe a descrição e o preço da sua proposta.", "warning");
      return;
    }
    setSending(true);
    try {
      await conversationAPI.respond(
        conversationId,
        { title: service.title, description: service.description, price: String(service.price ?? ""), deadline: service.deliveryTime ?? "" },
        service.attachments ?? [],
        token,
        negotiationId
      );
      setSent(true);
      onDone?.();
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível enviar a proposta."), "error");
    } finally {
      setSending(false);
    }
  };

  const handleReject = async (reason: string) => {
    try {
      await conversationAPI.reject(conversationId, reason, token, negotiationId);
      onDone?.();
      return true;
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível recusar o pedido."), "error");
      return false;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter((f) => f.size <= 8 * 1024 * 1024);
    setService({ ...service, attachments: [...(service.attachments || []), ...newFiles].slice(0, 8) });
    e.target.value = "";
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, filter: "blur(8px)" },
    visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.9, filter: "blur(6px)" },
  };

  return (
    <div
      className="fixed modal-scroll inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.4, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl md:rounded-2xl bg-[var(--bg)]/80
        backdrop-blur-xl border border-[rgba(255,255,255,0.15)] shadow-2xl text-[var(--text)]
        overflow-y-auto max-h-[90vh] md:max-h-[85vh] p-6 md:p-10"
      >
        {/* Botão X de Fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition"
        >
          <X className="w-5 h-5 text-[var(--text)]" />
        </button>

        <AnimatePresence mode="wait">
          {!clientProposal ? (
            <motion.div key="loading" className="py-16 text-center opacity-80">
              {loadError ?? "Carregando pedido..."}
            </motion.div>
          ) : !sent ? (
            <motion.div
              key="content"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-8"
            >
              {/* ------------------------------------------------------------------
               * RESUMO DA SOLICITAÇÃO
               * ------------------------------------------------------------------ */}
              <section>
                <h2 className="text-xl font-semibold mb-2">
                  Solicitação de {clientProposal.clientName}
                </h2>
                {clientProposal.serviceTitle && <p className="text-sm opacity-80 mb-2">Serviço: {clientProposal.serviceTitle}</p>}
                <div className="bg-black/30 rounded-xl p-4 border border-white/10 space-y-3 text-sm">
                  <p>
                    <strong>Descrição:</strong> {clientProposal.serviceDescription}
                  </p>
                  <p>
                    <strong>Orçamento:</strong> {clientProposal.budget}
                  </p>
                  <p>
                    <strong>Data solicitada:</strong> {clientProposal.date || "—"}
                  </p>
                  {clientProposal.notes && (
                    <p>
                      <strong>Observações:</strong> {clientProposal.notes}
                    </p>
                  )}
                  {clientProposal.files?.length ? (
                    <div>
                      <strong>Anexos do cliente:</strong>
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {clientProposal.files.map((file, i) => (
                          <a
                            key={i}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            title={file.name}
                            className="w-20 h-20 shrink-0 bg-[var(--bg-light)] rounded-lg border border-[var(--border)] flex flex-col items-center justify-center text-xs text-center p-1 overflow-hidden"
                          >
                            {/\.(png|jpe?g|gif|webp|svg)$/i.test(file.url) ? (
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <>
                                <FileText className="w-5 h-5 text-[var(--primary)]" />
                                {file.name.length > 10 ? file.name.slice(0, 10) + "..." : file.name}
                              </>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* ------------------------------------------------------------------
               * FORMULÁRIO DE RESPOSTA DO PRESTADOR
               * ------------------------------------------------------------------ */}
              <section className="space-y-5">
                <h3 className="text-lg font-semibold text-[var(--primary)]">
                  Sua proposta de serviço
                </h3>

                <FormField
                  label="Título do serviço"
                  value={service.title}
                  onChange={(v) => setService({ ...service, title: v })}
                  tooltip="Um título claro e direto ajuda o cliente a entender o que você está oferecendo."
                />

                <FormField
                  label="Descrição"
                  isTextArea
                  value={service.description}
                  onChange={(v) => setService({ ...service, description: v })}
                  tooltip="Explique como você executará o serviço solicitado."
                />

                <FormField
                  label="Preço"
                  value={service.price || ""}
                  onChange={(v) => setService({ ...service, price: v })}
                  tooltip="Defina o valor da sua proposta."
                />

                <FormField
                  label="Prazo de entrega (ou início)"
                  value={service.deliveryTime || ""}
                  onChange={(v) => setService({ ...service, deliveryTime: v })}
                  tooltip="Informe em quanto tempo você pode realizar o serviço."
                />

                {/* Upload de arquivos */}
                <div className="space-y-2">
                  <label className="block font-medium">Anexos (opcional)</label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                    className="flex items-center justify-center p-3 border border-[var(--border)] rounded-lg
                    bg-[rgba(255,255,255,0.1)] cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition"
                  >
                    <Upload className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Enviar anexos
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {service.attachments?.length ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {service.attachments.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 bg-black/40 border border-[var(--border)]
                          px-2 py-1 rounded-md text-xs backdrop-blur-sm"
                        >
                          <FileText className="w-3 h-3 text-[var(--primary)]" />
                          {f.name}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              {/* ------------------------------------------------------------------
               * AÇÕES FINAIS
               * ------------------------------------------------------------------ */}
              <section className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  onClick={handleRefuse}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-black/40 text-white hover:bg-black/60 transition border border-[var(--border)]"
                >
                  <XCircle className="w-5 h-5" />
                  Recusar proposta
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shadow-md disabled:opacity-60"
                >
                  <Send className="w-5 h-5" />
                  {sending ? "Enviando..." : "Enviar proposta de serviço"}
                </button>
              </section>
                 <RejectProposalModal
                    isOpen={rejectOpen}
                    onClose={() => setRejectOpen(false)}
                    onConfirm={handleReject}
                    onDone={onClose}
                />
            </motion.div>

          ) : (
            /* ------------------------------------------------------------------
             * CONFIRMAÇÃO DE ENVIO
             * ------------------------------------------------------------------ */
            <motion.div
              key="sent"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <CheckCircle2 className="w-16 h-16 text-[var(--primary)]" />
              <h2 className="text-xl font-semibold">Proposta enviada!</h2>
              <p className="opacity-80 text-center max-w-sm">
                Sua proposta foi enviada a {clientProposal.clientName}.
                A resposta aparece na negociação e no seu chat.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * CAMPO DE FORMULÁRIO REUTILIZÁVEL
 * -------------------------------------------------------------------------- */
function FormField({
  label,
  value,
  onChange,
  tooltip,
  isTextArea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tooltip?: string;
  isTextArea?: boolean;
}) {
  const id = "resp-" + label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="relative">
      <label htmlFor={id} className="block font-medium mb-1 text-white">{label}</label>
      {isTextArea ? (
        <textarea
          id={id}
          className="w-full p-3 rounded-lg border border-[var(--border)] bg-black/30 text-white
          focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="w-full p-3 rounded-lg border border-[var(--border)] bg-black/30 text-white
          focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {tooltip && <SmallTooltip text={tooltip} />}
    </div>
  );
}
