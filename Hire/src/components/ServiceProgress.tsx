// service_progress_full.tsx
// -------------------------
// Componente completo e tipado em TypeScript para Acompanhamento de Serviço
// - Versões: Prestador (Provider) e Contratante (Client)
// - Responsivo (mobile -> desktop)
// - Etapas reais do pedido (status do cliente e do prestador)
// - Usa variáveis CSS do projeto: --bg, --bg-light, --border, --text, --primary, --highlight

import { CheckCircle, MessageSquare, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PostCard from "./ServiceGallery/Service/Service";
import ConfirmModal from "./Common/ConfirmModal";
import ReviewModal from "./Reviews/ReviewModal";
import ChatInbox from "./Chat/ChatInbox";
import { hireAPI } from "../api/HireAPI";
import { reviewAPI } from "../api/ReviewAPI";
import { conversationAPI } from "../api/ConversationAPI";
import { toServiceData } from "../api/ServiceAPI";
import { useToast } from "./Toast/ToastContext";
import type { HireEntity } from "../interfaces/Entities";
import { HIRE_STEPS, HIRE_STAGE_LABEL, HIRE_STAGE_LABEL_PROVIDER, getHireStage, stepIndex } from "../utils/hireStatus";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";
import { defaultAvatar, uploadUrl } from "../utils/avatar";
import { getErrorMessage } from "../utils/errors";

/* -----------------------------
   Tipagens (Types) - fácil leitura
   ----------------------------- */
export type ServiceProgressProps = {
  // dados principais: a contratação vinda da API
  data: HireEntity;
  // profile: qual view renderizar: "provider" | "client" (comportamentos/ações diferentes)
  viewFor: "provider" | "client";
  // chamado depois de qualquer mudança de status (recarrega a lista)
  onChanged: () => void;
};

type Action = "begin" | "deliver" | "confirm" | "cancel";

const ACTION_TEXT: Record<Action, { title: string; confirm: string; done: string }> = {
  begin: { title: "Iniciar este serviço?", confirm: "Iniciar serviço", done: "Serviço iniciado!" },
  deliver: { title: "Marcar como concluído?", confirm: "Marcar como concluído", done: "Serviço marcado como concluído. Agora o cliente confirma." },
  confirm: { title: "Confirmar conclusão?", confirm: "Confirmar conclusão", done: "Conclusão confirmada!" },
  cancel: { title: "Cancelar este pedido?", confirm: "Cancelar pedido", done: "Pedido cancelado." },
};

const buttonClass = (primary = false) =>
  `px-4 py-3 rounded-xl border border-[var(--border)] ${primary ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-dark)]"}
   hover:bg-[var(--primary)] hover:text-white transition-all
   focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]
   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-60`;

/* -----------------------------
   Componente principal: ServiceProgress
   - Responsivo: usa grid que vira coluna em mobile
   ----------------------------- */
export function ServiceProgress({
  viewFor,
  data,
  onChanged,
}: ServiceProgressProps) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  // depois de confirmar a conclusão, a lista só recarrega quando o modal de avaliação fecha
  // (senão o card vai para "Encerradas" e o modal some junto)
  const refreshAfterReview = useRef(false);

  const stage = getHireStage(data);
  const currentIndex = stepIndex(stage);
  const providerName = data.provider?.companyName || data.provider?.professionalName || "Prestador";
  const clientName = data.user?.name ?? "Cliente";
  const titleId = `service-progress-title-${data.id}`;
  const actionsId = `actions-title-${data.id}`;
  const token = localStorage.getItem("token") ?? "";

  // Etapas reais; a primeira mostra a data do pedido
  const steps = HIRE_STEPS.map((s, i) => ({
    ...s,
    label: s.id === "delivered" && viewFor === "provider" ? "Entregue" : s.label,
    date: i === 0 ? formatDate(data.firstContact) : undefined,
  }));

  // Depois de concluído: já avaliei esta contratação?
  useEffect(() => {
    if (stage !== "done" || !token) return;
    reviewAPI
      .forHire(data.id, token)
      .then((list) =>
        setReviewed(list.some((r) => r.direction === (viewFor === "client" ? "CLIENT_TO_PROVIDER" : "PROVIDER_TO_CLIENT")))
      )
      .catch(() => setReviewed(null));
  }, [stage, data.id, viewFor, token]);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "begin") await hireAPI.beginHireProvider(data.id);
      if (pending === "deliver") await hireAPI.concludeHireProvider(data.id);
      if (pending === "confirm") await hireAPI.concludeHire(data.id);
      if (pending === "cancel") await hireAPI.cancelHire(data.id, viewFor);
      showToast(ACTION_TEXT[pending].done, "success");
      const wasConfirm = pending === "confirm";
      setPending(null);
      if (wasConfirm) {
        refreshAfterReview.current = true;
        setReviewOpen(true);
      } else onChanged();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível atualizar o pedido."), "error");
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    if (!data.service?.id) return;
    try {
      const conv = await conversationAPI.open({ serviceId: data.service.id }, token);
      setChatId(conv.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a conversa."), "error");
    }
  };

  const statusLabel = (viewFor === "client" ? HIRE_STAGE_LABEL : HIRE_STAGE_LABEL_PROVIDER)[stage];
  const serviceForCard = data.service
    ? toServiceData({ ...data.service, provider: data.service.provider ?? data.provider ?? null })
    : null;

  return (
    <div
      className="w-full h-full p-6 mt-20 border-1 border-[var(--border)] md:p-10 bg-[var(--bg-light)] rounded-2xl text-[var(--text)] shadow-lg hover:shadow-[0_0_25px_-5px_var(--primary)/20]"
      role="region"
      aria-labelledby={titleId}
    >
      <div className="flex flex-col md:flex-row md:justify-between gap-6">
        <div>
          {/* HEADER ------------------------------------------------------ */}
          <header
            className="flex flex-col  md:flex-row md:mt-10 max-w-150 md:items-start md:justify-between gap-4"
            aria-live="polite"
          >
            <div >
              <h2 id={titleId} className="text-3xl  md:text-4xl font-bold">
                {data.service?.title ?? data.description_service}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Nº do pedido: {String(data.id).padStart(4, "0")} · {formatCurrency(data.price)} · <strong className="text-[var(--text)]">{statusLabel}</strong>
              </p>
              {data.scheduledAt && (
                <p className="text-xs text-[var(--text)] mt-1">Agendado para {formatDateTime(data.scheduledAt)}</p>
              )}
            </div>


          </header>

          {/* GRID LAYOUT ------------------------------------------------ */}

          <div className="">

            <main className="lg:col-span-2 md:w-100">
              {/* USERS --------------------------------------------------- */}
              <div
                className="flex items-center gap-6 mb-6 mt-8"
                role="group"
                aria-label="Prestador e contratante"
              >
                <UserBadge name={providerName} role="Prestador" photo={uploadUrl(data.provider?.profileImageUrl) ?? defaultAvatar(providerName)} />
                <span className="text-sm text-[var(--text-muted)]">—</span>
                <UserBadge name={clientName} role="Cliente" photo={defaultAvatar(clientName)} />
              </div>

              {stage === "cancelled" ? (
                <p className="mb-6 text-sm text-red-500">Este pedido foi cancelado.</p>
              ) : (
              /* TIMELINE ------------------------------------------------ */
              <section aria-label="Linha do tempo do serviço" className="mb-6">
                <div
                  className="flex gap-4 items-center overflow-x-auto py-3"
                  role="list"
                >
                  {steps.map((s, i) => {
                    const completed = i <= currentIndex;
                    const isCurrent = i === currentIndex;

                    return (
                      <div
                        key={s.id}
                        role="listitem"
                        aria-label={`Etapa: ${s.label} ${completed ? "(concluída)" : "(pendente)"
                          }`}
                        aria-current={isCurrent ? "step" : undefined}
                        className="flex flex-col items-center min-w-[120px]"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                      ${completed ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-[var(--bg-light)] border-[var(--border)]"}`}
                        >
                          {completed ? (
                            <CheckCircle size={16} className="text-white" aria-hidden />
                          ) : (
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${completed ? "bg-white" : "bg-[var(--border)]"}`}
                              aria-hidden
                            />
                          )}
                        </div>

                        <p className="text-sm font-semibold text-center mt-3 text-[var(--text)]">
                          {s.label}
                        </p>
                        {s.date && (
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            {s.date}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              )}

              {/* ACTIONS ------------------------------------------------- */}
              <section aria-labelledby={actionsId} className="mb-6">
                <h3 id={actionsId} className="text-lg font-semibold mb-3">
                  Ações
                </h3>

                <div
                  role="group"
                  aria-labelledby={actionsId}
                  className="flex flex-col sm:flex-row flex-wrap gap-3"
                >
                  {viewFor === "provider" ? (
                    <>
                      {stage === "requested" && (
                        <>
                          <button className={buttonClass(true)} onClick={() => setPending("begin")}>
                            Iniciar serviço
                          </button>
                          <button className={buttonClass()} onClick={() => setPending("cancel")}>
                            Recusar pedido
                          </button>
                        </>
                      )}
                      {stage === "in_progress" && (
                        <button className={buttonClass(true)} onClick={() => setPending("deliver")}>
                          Marcar como concluído
                        </button>
                      )}
                      {stage === "delivered" && (
                        <p className="text-sm text-[var(--text-muted)]">Aguardando o cliente confirmar a conclusão.</p>
                      )}
                    </>
                  ) : (
                    <>
                      {stage === "requested" && (
                        <>
                          <p className="text-sm text-[var(--text-muted)] sm:self-center">Aguardando o prestador iniciar.</p>
                          <button className={buttonClass()} onClick={() => setPending("cancel")}>
                            Cancelar pedido
                          </button>
                        </>
                      )}
                      {stage === "in_progress" && (
                        <p className="text-sm text-[var(--text-muted)]">O prestador está realizando o serviço.</p>
                      )}
                      {stage === "delivered" && (
                        <button className={buttonClass(true)} onClick={() => setPending("confirm")}>
                          Confirmar conclusão
                        </button>
                      )}
                      {stage !== "cancelled" && (
                        <button className={`${buttonClass()} flex items-center gap-2`} onClick={openChat}>
                          <MessageSquare size={16} /> Mensagem
                        </button>
                      )}
                    </>
                  )}

                  {stage === "done" && reviewed === false && (
                    <button className={`${buttonClass(true)} flex items-center gap-2`} onClick={() => setReviewOpen(true)}>
                      <Star size={16} /> Avaliar {viewFor === "client" ? "prestador" : "cliente"}
                    </button>
                  )}
                  {stage === "done" && reviewed && (
                    <p className="text-sm text-[var(--text-muted)]">Você já avaliou esta contratação. Obrigado!</p>
                  )}
                </div>
              </section>
            </main>

          </div>



        </div>
        {/* SIDEBAR -------------------------------------------------- */}
        {serviceForCard && (
        <aside className="flex relative  flex-col items-end " aria-label="Detalhes do serviço">
          <PostCard service={serviceForCard} noEdit={true} />
        </aside>
        )}
      </div>

      {pending && (
        <ConfirmModal
          open={!!pending}
          title={ACTION_TEXT[pending].title}
          confirmLabel={ACTION_TEXT[pending].confirm}
          cancelLabel="Voltar"
          danger={pending === "cancel"}
          loading={busy}
          onConfirm={run}
          onClose={() => setPending(null)}
        />
      )}

      <ReviewModal
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          if (refreshAfterReview.current) {
            refreshAfterReview.current = false;
            onChanged();
          }
        }}
        hireId={data.id}
        targetName={viewFor === "client" ? providerName : clientName}
        serviceTitle={data.service?.title}
        targetRole={viewFor === "client" ? "provider" : "client"}
        onDone={() => setReviewed(true)}
      />

      <ChatInbox isOpen={!!chatId} initialConversationId={chatId} onClose={() => setChatId(null)} />
    </div>
  );
}

/* -----------------------------
   Subcomponentes pequenos: UserBadge
   - Componentização melhora organização e facilita testes unitários
   ----------------------------- */
function UserBadge(user: { name: string, role: string, photo: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--bg-light)] border border-[var(--border)] flex items-center justify-center">
          <img src={user.photo} alt="" className="w-full h-full object-cover" />
      </div>
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-[var(--text-muted)]">{user.role}</div>
      </div>
    </div>
  );
}
