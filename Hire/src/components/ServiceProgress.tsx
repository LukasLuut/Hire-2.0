// service_progress_full.tsx
// -------------------------
// Componente completo e tipado em TypeScript para Acompanhamento de Serviço
// - Versões: Prestador (Provider) e Contratante (Client)
// - Responsivo (mobile -> desktop)
// - Etapas reais do pedido (status do cliente e do prestador)
// - Usa variáveis CSS do projeto: --bg, --bg-light, --border, --text, --primary, --highlight

import { CheckCircle, MessageSquare, Star, RotateCcw, CalendarClock, Flag, ShieldAlert, Wallet } from "lucide-react";
import ReportModal from "./Reports/ReportModal";
import { SlotPicker, noticeHours, localDateTimeKey, type Agenda } from "./Schedule";
import { useEffect, useRef, useState } from "react";
import PostCard from "./ServiceGallery/Service/Service";
import ConfirmModal from "./Common/ConfirmModal";
import ReviewModal from "./Reviews/ReviewModal";
import ChatInbox from "./Chat/ChatInbox";
import { hireAPI } from "../api/HireAPI";
import { reviewAPI } from "../api/ReviewAPI";
import { conversationAPI } from "../api/ConversationAPI";
import { serviceImages, toServiceData } from "../api/ServiceAPI";
import ServiceDetail from "./ServiceGallery/ServiceDetail/ServiceDetail";
import { useToast } from "./Toast/ToastContext";
import type { HireEntity, PaymentMethod, ServiceAddress } from "../interfaces/Entities";
import ServiceAddressForm from "./Hires/ServiceAddressForm";
import PaymentMethodPicker from "./Payment/PaymentMethodPicker";
import { METHOD_LABEL } from "../utils/payment";
import { HIRE_STEPS, HIRE_STAGE_LABEL, HIRE_STAGE_LABEL_PROVIDER, getHireStage, stepIndex } from "../utils/hireStatus";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";
import { defaultAvatar, uploadUrl } from "../utils/avatar";
import { getErrorMessage } from "../utils/errors";
import { getFirstAndLastName } from "../utils/nameUtils";

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

type Action = "accept" | "begin" | "deliver" | "confirm" | "cancel" | "reschedule" | "schedule" | "pay" | "address";

const ACTION_TEXT: Record<Action, { title: string; confirm: string; done: string }> = {
  accept: { title: "Aceitar este pedido?", confirm: "Aceitar pedido", done: "Pedido aceito. O cliente foi avisado." },
  begin: { title: "Iniciar este serviço?", confirm: "Iniciar serviço", done: "Serviço iniciado!" },
  deliver: { title: "Marcar como concluído?", confirm: "Marcar como concluído", done: "Serviço marcado como concluído. Agora o cliente confirma." },
  confirm: { title: "Confirmar conclusão?", confirm: "Confirmar conclusão", done: "Conclusão confirmada!" },
  cancel: { title: "Cancelar este pedido?", confirm: "Cancelar pedido", done: "Pedido cancelado." },
  reschedule: { title: "Propor outro horário", confirm: "Enviar proposta", done: "Proposta enviada. A outra parte precisa aceitar." },
  schedule: { title: "Escolher o horário", confirm: "Marcar horário", done: "Horário marcado. O prestador foi avisado." },
  address: { title: "Endereço do atendimento", confirm: "Salvar endereço", done: "Endereço salvo." },
  pay: { title: "Pagamento", confirm: "Pagar", done: "Pagamento confirmado. O valor fica guardado até você confirmar a conclusão." },
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
  const [rehireOpen, setRehireOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [chatId, setChatId] = useState<number | null>(null);
  // novo horário proposto (agenda do serviço sem contar este pedido)
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [address, setAddress] = useState<ServiceAddress | null>(null);
  // depois de confirmar a conclusão, a lista só recarrega quando o modal de avaliação fecha
  // (senão o card vai para "Encerradas" e o modal some junto)
  const refreshAfterReview = useRef(false);

  const stage = getHireStage(data);
  const currentIndex = stepIndex(stage);
  const providerName = data.provider?.companyName || data.provider?.professionalName || "Prestador";
  const clientName = getFirstAndLastName(data.user?.name ?? "") || "Cliente";
  const titleId = `service-progress-title-${data.id}`;
  const actionsId = `actions-title-${data.id}`;
  const token = localStorage.getItem("token") ?? "";

  const stepDate = (id: string) => {
    const at = id === "accepted" ? data.acceptedAt : id === "in_progress" ? data.startedAt : id === "delivered" ? data.finishedAt : id === "done" ? data.confirmedAt : null;
    return at ? formatDateTime(at) : undefined;
  };
  // Etapas reais; a primeira mostra a data do pedido
  const steps = HIRE_STEPS.map((s, i) => ({
    ...s,
    label: s.id === "delivered" && viewFor === "provider" ? "Entregue" : s.label,
    // horários reais de cada etapa (quando existirem)
    date: i === 0 ? formatDate(data.firstContact) : stepDate(s.id),
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
      if (pending === "accept") await hireAPI.acceptHire(data.id);
      if (pending === "begin") await hireAPI.beginHireProvider(data.id);
      if (pending === "deliver") await hireAPI.concludeHireProvider(data.id);
      if (pending === "confirm") await hireAPI.concludeHire(data.id);
      if (pending === "cancel") await hireAPI.cancelHire(data.id, viewFor, cancelReason);
      if (pending === "address") {
        if (!address) return;
        await hireAPI.setAddress(data.id, address);
      }
      if (pending === "pay") {
        if (!method) { showToast("Escolha a forma de pagamento.", "warning"); return; }
        await hireAPI.pay(data.id, method);
      }
      if (pending === "reschedule" || pending === "schedule") {
        if (!newSlot) { showToast("Escolha o horário.", "warning"); return; }
        await (pending === "schedule" ? hireAPI.schedule : hireAPI.reschedule)(data.id, newSlot);
      }
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

  const openReschedule = (action: "reschedule" | "schedule" = "reschedule") => {
    setNewSlot(null);
    setAgenda(null);
    setPending(action);
    if (data.service?.id) hireAPI.bookedSlots(data.service.id, data.id).then(setAgenda).catch(() => setAgenda({ busy: [], hours: {}, durationMinutes: 60 }));
  };

  const answerReschedule = async (accept: boolean) => {
    setBusy(true);
    try {
      await hireAPI.answerReschedule(data.id, accept);
      showToast(accept ? "Horário alterado." : "Proposta de horário encerrada.", "success");
      onChanged();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível responder."), "error");
    } finally {
      setBusy(false);
    }
  };

  // a proposta de horário pendente é minha ou da outra parte?
  const me = viewFor === "client" ? "cliente" : "prestador";
  const canReschedule = !!data.scheduledAt && (stage === "requested" || stage === "accepted");
  // pedido que veio de uma negociação: serviço com agenda ainda sem horário marcado
  const awaitingSchedule = stage === "accepted" && !!data.service?.requiresScheduling && !data.scheduledAt;
  // aceito e ainda não pago (pedidos antigos não têm essa etapa)
  const awaitingPayment = stage === "accepted" && !!data.paymentRequired && !data.payment;
  const payment = data.payment;
  // atendimento presencial: endereço (o cliente pode trocar antes de começar)
  const presencial = !!data.service && !data.service.online;
  const addr = data.serviceAddress;
  const awaitingAddress = presencial && !!data.paymentRequired && !addr && (stage === "requested" || stage === "accepted");
  const canEditAddress = viewFor === "client" && presencial && (stage === "requested" || stage === "accepted");
  const openAddress = () => { setAddress(addr ?? null); setPending("address"); };
  // cancelar agora cai dentro do prazo do serviço? (só conta para pedido aceito)
  const notice = noticeHours(data.service?.cancellationNotice);
  const lateNow = !!data.scheduledAt && !!data.acceptedAt && notice > 0 && Date.now() > new Date(data.scheduledAt).getTime() - notice * 3600000;

  const openChat = async () => {
    if (!data.service?.id) return;
    try {
      const conv = await conversationAPI.open({ serviceId: data.service.id }, token);
      setChatId(conv.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a conversa."), "error");
    }
  };

  const statusLabel = awaitingPayment
    ? "Aceito — aguardando pagamento"
    : awaitingSchedule
      ? "Aceito — aguardando horário"
      : (viewFor === "client" ? HIRE_STAGE_LABEL : HIRE_STAGE_LABEL_PROVIDER)[stage];
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
                Nº do pedido: {String(data.id).padStart(4, "0")} · {formatCurrency(data.price)}
                {data.packageName ? ` · pacote ${data.packageName}` : ""}
                {data.quantity ? ` · ${data.quantity} ${data.service?.priceUnit === "m2" ? "m²" : "h"}` : ""} · <strong className="text-[var(--text)]">{statusLabel}</strong>
              </p>
              {data.scheduledAt && (
                <p className="text-xs text-[var(--text)] mt-1">Agendado para {formatDateTime(data.scheduledAt)}</p>
              )}
              {presencial && (addr || awaitingAddress) && (
                <p className={`text-xs mt-1 ${addr ? "text-[var(--text)]" : "text-amber-500"}`}>
                  {addr
                    ? addr.street
                      ? `Atendimento em ${addr.street}, ${addr.num}${addr.complement ? ` (${addr.complement})` : ""} — ${addr.neighborhood}, ${addr.city}/${addr.state}`
                      : `Atendimento em ${addr.neighborhood}, ${addr.city}/${addr.state} (endereço completo liberado depois do aceite)`
                    : viewFor === "client" ? "Informe o endereço do atendimento." : "O cliente ainda não informou o endereço."}
                  {canEditAddress && (
                    <button type="button" onClick={openAddress} className="ml-2 underline text-[var(--primary)] hover:opacity-80">
                      {addr ? "Alterar" : "Informar endereço"}
                    </button>
                  )}
                </p>
              )}
              {payment && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {payment.status === "ESTORNADO"
                    ? `Pagamento estornado (${formatCurrency(payment.amount)}).`
                    : viewFor === "client"
                      ? `Pago via ${METHOD_LABEL[payment.method]} · ${payment.status === "LIBERADO" ? "repassado ao prestador" : "valor guardado pela Hire até você confirmar a conclusão"}.`
                      : `Pago pelo cliente · você recebe ${formatCurrency(payment.net)} (taxa Hire ${formatCurrency(payment.fee)})${payment.status === "LIBERADO" ? " · liberado" : " quando o cliente confirmar a conclusão"}.`}
                </p>
              )}
              {awaitingSchedule && (
                <p className="text-xs text-amber-500 mt-1">Horário a definir: {viewFor === "client" ? "escolha na agenda do prestador" : "o cliente vai escolher na sua agenda"}.</p>
              )}
              {viewFor === "provider" && !!data.clientLateCancellations && (
                <p className="text-xs text-amber-500 mt-1">Este cliente cancelou {data.clientLateCancellations} pedido(s) em cima da hora nos últimos 12 meses.</p>
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
                <p className="mb-6 text-sm text-red-500">
                  {data.cancelledBy === "sistema"
                    ? "Este pedido expirou: o prestador não respondeu a tempo."
                    : data.cancelledBy === "prestador"
                      ? `${data.acceptedAt ? "Cancelado" : "Recusado"} pelo prestador.`
                      : data.cancelledBy === "cliente"
                        ? "Cancelado pelo cliente."
                        : "Este pedido foi cancelado."}
                  {data.lateCancel && <span className="block text-amber-500 mt-1">Cancelado depois do prazo de cancelamento ({data.service?.cancellationNotice}).</span>}
                  {data.cancelReason && data.cancelledBy !== "sistema" && <span className="block text-[var(--text-muted)] mt-1">Motivo: {data.cancelReason}</span>}
                </p>
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

                {data.disputed && (
                  <p role="status" className="mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-amber-500 flex items-center gap-2">
                    <ShieldAlert size={16} /> Problema relatado neste pedido, em análise pela administração. As avaliações ficam bloqueadas até lá.
                  </p>
                )}
                {data.rescheduleTo && canReschedule && (
                  <div role="status" className="mb-4 p-4 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      <CalendarClock size={16} />
                      {data.rescheduleBy === me
                        ? `Você propôs mudar para ${formatDateTime(data.rescheduleTo)}. Aguardando resposta.`
                        : `${data.rescheduleBy === "cliente" ? clientName : providerName} propôs mudar para ${formatDateTime(data.rescheduleTo)}.`}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.rescheduleBy === me ? (
                        <button className={buttonClass()} disabled={busy} onClick={() => answerReschedule(false)}>Retirar proposta</button>
                      ) : (
                        <>
                          <button className={buttonClass(true)} disabled={busy} onClick={() => answerReschedule(true)}>Aceitar novo horário</button>
                          <button className={buttonClass()} disabled={busy} onClick={() => answerReschedule(false)}>Manter horário atual</button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div
                  role="group"
                  aria-labelledby={actionsId}
                  className="flex flex-col sm:flex-row flex-wrap gap-3"
                >
                  {canReschedule && !data.rescheduleTo && (
                    <button className={`${buttonClass()} flex items-center gap-2`} onClick={() => openReschedule()}>
                      <CalendarClock size={16} /> Mudar horário
                    </button>
                  )}
                  {viewFor === "provider" ? (
                    <>
                      {stage === "requested" && (
                        <>
                          <button className={buttonClass(true)} onClick={() => setPending("accept")}>
                            Aceitar pedido
                          </button>
                          <button className={buttonClass()} onClick={() => { setCancelReason(""); setPending("cancel"); }}>
                            Recusar pedido
                          </button>
                        </>
                      )}
                      {stage === "accepted" && (
                        <>
                          {awaitingPayment || awaitingSchedule || awaitingAddress ? (
                            <p className="text-sm text-[var(--text-muted)] sm:self-center">
                              {awaitingPayment ? "Aguardando o pagamento do cliente." : awaitingSchedule ? "Aguardando o cliente escolher o horário na sua agenda." : "Aguardando o cliente informar o endereço."}
                            </p>
                          ) : (
                            <button className={buttonClass(true)} onClick={() => setPending("begin")}>
                              Iniciar serviço
                            </button>
                          )}
                          <button className={buttonClass()} onClick={() => { setCancelReason(""); setPending("cancel"); }}>
                            Cancelar pedido
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
                      {(stage === "requested" || stage === "accepted") && (
                        <>
                          {awaitingPayment && (
                            <button className={`${buttonClass(true)} flex items-center gap-2`} onClick={() => { setMethod(null); setPending("pay"); }}>
                              <Wallet size={16} /> Pagar {formatCurrency(data.price)}
                            </button>
                          )}
                          {awaitingSchedule ? (
                            <button className={`${buttonClass(!awaitingPayment)} flex items-center gap-2`} onClick={() => openReschedule("schedule")}>
                              <CalendarClock size={16} /> Escolher horário
                            </button>
                          ) : !awaitingPayment && (
                            <p className="text-sm text-[var(--text-muted)] sm:self-center">
                              {stage === "requested" ? "Aguardando o prestador aceitar. Sem resposta em 48 h, o pedido expira." : "Pedido aceito. Aguardando o prestador iniciar."}
                            </p>
                          )}
                          <button className={buttonClass()} onClick={() => { setCancelReason(""); setPending("cancel"); }}>
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

                  {stage === "done" && reviewed === false && !data.disputed && (
                    <button className={`${buttonClass(true)} flex items-center gap-2`} onClick={() => setReviewOpen(true)}>
                      <Star size={16} /> Avaliar {viewFor === "client" ? "prestador" : "cliente"}
                    </button>
                  )}
                  {stage === "done" && reviewed && (
                    <p className="text-sm text-[var(--text-muted)]">Você já avaliou esta contratação. Obrigado!</p>
                  )}
                  {stage !== "requested" && !data.disputed && (
                    <button className={`${buttonClass()} flex items-center gap-2 text-[var(--text-muted)]`} onClick={() => setReportOpen(true)}>
                      <Flag size={16} /> Relatar problema
                    </button>
                  )}
                  {/* recontratar: abre o serviço já com "Contratar novamente" */}
                  {viewFor === "client" && (stage === "done" || stage === "cancelled") && data.service && (
                    <button className={`${buttonClass()} flex items-center gap-2`} onClick={() => setRehireOpen(true)}>
                      <RotateCcw size={16} /> Contratar de novo
                    </button>
                  )}
                </div>
              </section>
            </main>

          </div>



        </div>
        {/* SIDEBAR -------------------------------------------------- */}
        {serviceForCard && (
        <aside className="relative w-full md:w-80 lg:w-96 shrink-0 self-start" aria-label="Detalhes do serviço">
          <PostCard service={serviceForCard} noEdit={true} />
        </aside>
        )}
      </div>

      {pending && (
        <ConfirmModal
          open={!!pending}
          title={pending === "cancel" && viewFor === "provider" && stage === "requested" ? "Recusar este pedido?" : ACTION_TEXT[pending].title}
          confirmLabel={pending === "cancel" && viewFor === "provider" && stage === "requested" ? "Recusar pedido" : ACTION_TEXT[pending].confirm}
          cancelLabel="Voltar"
          danger={pending === "cancel"}
          loading={busy}
          onConfirm={run}
          onClose={() => setPending(null)}
        >
          {pending === "address" && (
            <div className="grid gap-2">
              <p className="text-sm text-[var(--text-muted)]">O prestador vê o endereço completo só depois de aceitar o pedido.</p>
              <ServiceAddressForm value={address} onChange={setAddress} />
            </div>
          )}
          {pending === "pay" && (
            <div className="text-sm grid gap-3">
              <p className="flex justify-between text-[var(--text)]">
                <span>{data.service?.title ?? data.description_service}</span>
                <strong>{formatCurrency(data.price)}</strong>
              </p>
              <PaymentMethodPicker value={method} onChange={setMethod} />
              <p className="text-xs text-[var(--text-muted)]">
                O valor fica guardado pela Hire e só é repassado ao prestador quando você confirmar a conclusão. Se o pedido for cancelado, você recebe de volta.
                <strong className="block mt-1">Ambiente de demonstração: nenhum valor é cobrado de verdade.</strong>
              </p>
            </div>
          )}
          {(pending === "reschedule" || pending === "schedule") && (
            <div className="text-sm">
              <p className="text-[var(--text-muted)] mb-3">
                {pending === "schedule"
                  ? "Escolha um horário livre na agenda do prestador. Ele é avisado na hora."
                  : <>Horário atual: {data.scheduledAt && formatDateTime(data.scheduledAt)}. A outra parte recebe a proposta e decide.</>}
              </p>
              {agenda ? (
                <SlotPicker slots={data.service?.scheduleSlots ?? null} agenda={agenda} value={newSlot} onChange={setNewSlot} hide={data.scheduledAt ? localDateTimeKey(new Date(data.scheduledAt)) : undefined} />
              ) : (
                <p className="text-[var(--text-muted)]">Carregando agenda…</p>
              )}
            </div>
          )}
          {pending === "cancel" && lateNow && (
            <p role="alert" className="text-sm text-amber-500">
              Faltam menos de {notice} h para o atendimento ({data.service?.cancellationNotice}). O cancelamento fica registrado no seu perfil. Se possível, proponha outro horário.
            </p>
          )}
          {pending === "cancel" && (
            <label className="block mt-3 text-sm">
              <span className="text-[var(--text-muted)]">Motivo (opcional, a outra parte verá)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={300}
                rows={3}
                className="mt-1 w-full p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
              />
            </label>
          )}
        </ConfirmModal>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSent={onChanged}
        hireId={data.id}
        subject={`Pedido ${String(data.id).padStart(4, "0")} — ${data.service?.title ?? data.description_service}`}
      />

      {rehireOpen && data.service && (
        <ServiceDetail
          service={toServiceData(data.service)}
          images={serviceImages(toServiceData(data.service))}
          isOpen
          onClose={() => setRehireOpen(false)}
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
