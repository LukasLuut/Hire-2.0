import { useState, useEffect, useRef, useCallback } from "react";
import { providerPath } from "../../../utils/providerPath";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X,
  MessageCircle,
  Handshake,
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  Pencil,
  Loader2,
} from "lucide-react";
import { serviceAPI, type ServiceData } from "../../../api/ServiceAPI";
import { hireAPI } from "../../../api/HireAPI";
import { reviewAPI } from "../../../api/ReviewAPI";
import { conversationAPI } from "../../../api/ConversationAPI";
import { useToast } from "../../../components/Toast/ToastContext";
import { useSession } from "../../../context/SessionContext";
import ChatInbox from "../../Chat/ChatInbox";
import ReviewModal from "../../Reviews/ReviewModal";
import ServiceNegotiationModal from "../../Negotiation/ServiceNegotiationModal";
import { SlotPicker, type Agenda } from "../../Schedule";
import type { HireEntity } from "../../../interfaces/Entities";
import { formatCurrency } from "../../../utils/format";
import { formatServicePrice, displayServicePrice, isQuoteOnly, needsQuantity } from "../../../utils/price";
import { getErrorMessage } from "../../../utils/errors";
import { HIRE_STAGE_LABEL, getHireStage } from "../../../utils/hireStatus";


/* --------------------------------------------------------------------------
 * Tipos
 * -------------------------------------------------------------------------- */
interface ServiceDetailProps {
  service: ServiceData;
  images: string[]
  isOpen: boolean;
  onClose: () => void;
  /** Quando quem vê é o dono do serviço: mostra "Editar" no lugar de "Contratar" */
  onEdit?: () => void;
}

/* --------------------------------------------------------------------------
 * Componente principal
 * -------------------------------------------------------------------------- */
export default function ServiceDetail({
  service,
  images,
  isOpen,
  onClose,
  onEdit,
}: ServiceDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [direction, setDirection] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(service.likesNumber ?? 0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [myHire, setMyHire] = useState<HireEntity | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [confirming, setConfirming] = useState<null | "hire" | "conclude">(null)
  const [busy, setBusy] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [chatId, setChatId] = useState<number | null>(null)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [slot, setSlot] = useState<string | null>(null)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  // preço: pacote escolhido e quantidade (horas/m²)
  const [pkgIndex, setPkgIndex] = useState<number | null>(null)
  const [quantity, setQuantity] = useState("")
  const packages = service.packages ?? []
  const quoteOnly = isQuoteOnly(service.priceUnit)
  const qtyUnit = service.priceUnit === "m2" ? "m²" : "horas"
  const qtyNum = Number(quantity.replace(",", "."))
  const hireTotal = packages.length
    ? pkgIndex != null ? packages[pkgIndex].price : null
    : needsQuantity(service.priceUnit)
      ? qtyNum > 0 ? Number(service.price) * qtyNum : null
      : Number(service.price)
  const { showToast } = useToast();
  const { user, provider } = useSession();
  const navigate = useNavigate();

  const isOwner = !!provider && provider.id === service.provider?.id;
  const providerName = service.provider?.companyName || service.provider?.professionalName || "Prestador";
  const token = localStorage.getItem("token") ?? "";

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ----------------------- Auto-play inteligente ----------------------- */
  useEffect(() => {
    if (!isOpen || isDragging || images.length < 2) return;

    intervalRef.current = setInterval(() => {
      slideNext();
    }, 7000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDragging, images.length]);

  // Esc fecha o modal
  useEffect(() => {
    if (!isOpen || imageModalOpen || reviewOpen || chatId || quoteOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, imageModalOpen, reviewOpen, chatId, quoteOpen, onClose]);

  const slideNext = () => {
    setDirection(1);
    setCurrentIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const slidePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    setIsDragging(false);

    if (offset < -50 || velocity < -500) slideNext();
    else if (offset > 50 || velocity > 500) slidePrev();
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  // Minha contratação mais recente deste serviço (e se já avaliei)
  const loadMyHire = useCallback(async () => {
    if (!token || isOwner) return;
    try {
      const hires = await hireAPI.getMine(token);
      const mine = hires.find((h) => h.service?.id === service.id && getHireStage(h) !== "cancelled") ?? null;
      setMyHire(mine);
      if (mine && getHireStage(mine) === "done") {
        const reviews = await reviewAPI.forHire(mine.id, token);
        setReviewed(reviews.some((r) => r.direction === "CLIENT_TO_PROVIDER"));
      } else setReviewed(false);
    } catch {
      setMyHire(null);
    }
  }, [token, isOwner, service.id]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirming(null);
    setLikes(service.likesNumber ?? 0);
    loadMyHire();
    if (token) serviceAPI.likedIds(token).then((ids) => setLiked(ids.includes(service.id))).catch(() => {});
  }, [isOpen, service.id, service.likesNumber, loadMyHire, token]);

  // agenda: horários já reservados com o prestador (carrega ao abrir a confirmação)
  useEffect(() => {
    if (confirming !== "hire" || !service.requiresScheduling) return;
    setSlot(null);
    setAgenda(null);
    hireAPI.bookedSlots(service.id).then(setAgenda).catch(() => setAgenda({ busy: [], hours: {}, durationMinutes: 60 }));
  }, [confirming, service.id, service.requiresScheduling]);

  const stage = myHire ? getHireStage(myHire) : null;
  const hasHire = !!myHire && stage !== "done";

  const handleLike = async () => {
    if (!token) return;
    setLiked((v) => !v);
    try {
      const r = await serviceAPI.toggleLike(service.id, token);
      setLiked(r.liked);
      setLikes(r.likesNumber);
    } catch (err) {
      setLiked((v) => !v);
      showToast(getErrorMessage(err, "Não foi possível curtir agora."), "error");
    }
  };

  // Contratar: cria o pedido depois da confirmação
  const handleNegociar = async () => {
    if (!user || !service.provider?.id) {
      showToast("Não foi possível identificar o prestador deste serviço.", "warning");
      return;
    }
    if (service.requiresScheduling && !slot) {
      showToast("Escolha um horário na agenda.", "warning");
      return;
    }
    if (hireTotal == null) {
      showToast(packages.length ? "Escolha um pacote." : `Informe a quantidade de ${qtyUnit}.`, "warning");
      return;
    }
    setBusy(true);
    try {
      await hireAPI.create({
        price: hireTotal,
        serviceId: Number(service.id),
        scheduledAt: slot ?? undefined,
        packageIndex: packages.length ? pkgIndex! : undefined,
        quantity: !packages.length && needsQuantity(service.priceUnit) ? qtyNum : undefined,
      });
      showToast("Serviço contratado! Acompanhe em Contratações.", "success");
      setConfirming(null);
      await loadMyHire();
    } catch (err) {
      showToast(getErrorMessage(err, "Erro ao contratar o serviço."), "error");
    } finally {
      setBusy(false);
    }
  }

  // Mensagem: abre (ou retoma) a negociação com o prestador sobre este serviço
  const handleMensagem = async () => {
    if (!token) return;
    try {
      const conv = await conversationAPI.open({ serviceId: service.id }, token);
      setChatId(conv.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a conversa."), "error");
    }
  };

  // Concluir: só depois que o prestador marcou como entregue; em seguida, avaliar
  const handleConcluir = async () => {
    if (!myHire) return;
    setBusy(true);
    try {
      await hireAPI.concludeHire(myHire.id);
      showToast("Serviço concluído com sucesso", "success");
      setConfirming(null);
      await loadMyHire();
      setReviewOpen(true);
    }
    catch(err) {
      showToast(getErrorMessage(err, "Não foi possível concluir."), "error")
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* ----------------------- Modal principal ----------------------- */}
          <motion.div
            key="preview"
            className="relative w-[92%] md:w-[640px] max-h-[92vh] overflow-y-auto bg-[var(--bg-light)] rounded-3xl shadow-2xl border border-[var(--border)] flex flex-col"
            custom={direction}
            variants={variants}
            initial={{ scale: 0.8, opacity: 0 }}
             animate={{
          scale: [0.8,  1],
          opacity: 1
        }}
        exit={{ scale: [1,  0.7], opacity: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.175, 0.885, 0.32, 1.275], // curva com bounce suave
          times: [0,  1],
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
          >
            {/* ----------------------- Botão fechar ----------------------- */}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-3 right-3 text-[var(--text)] hover:text-[var(--primary)] transition-colors z-20"
            >
              <X size={24} />
            </button>

            {/* ----------------------- Carrossel ----------------------- */}
            <div className="relative w-full h-72 md:h-80 overflow-hidden rounded-t-3xl select-none">
              <AnimatePresence custom={direction} mode="wait">
                <motion.img
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={service.title}
                  className="absolute w-full h-full object-cover cursor-pointer"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setImageModalOpen(true)}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5 }}
                />
              </AnimatePresence>

              {/* Ícone de like */}
              <button
                onClick={handleLike}
                aria-label={liked ? "Descurtir" : "Curtir"}
                aria-pressed={liked}
                className="absolute top-1 right-11 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full z-10 transition flex items-center gap-1"
              >
                <Heart
                  size={20}
                  className={`transition-transform ${
                    liked ? "fill-[var(--primary)] scale-110" : "scale-100"
                  }`}
                />
                {likes > 0 && <span className="text-xs pr-1">{likes}</span>}
              </button>

              {/* Botões laterais (desktop) */}
              {images.length > 1 && (<>
              <button
                onClick={slidePrev}
                aria-label="Imagem anterior"
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 p-2 rounded-full text-white z-10 transition"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={slideNext}
                aria-label="Próxima imagem"
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 p-2 rounded-full text-white z-10 transition"
              >
                <ChevronRight size={22} />
              </button>
              </>)}

              {/* Indicadores */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                {images.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? "bg-[var(--primary)] scale-125"
                        : "bg-[var(--text-muted)] opacity-60"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ----------------------- Conteúdo ----------------------- */}
            <div className="p-6 flex flex-col gap-4 text-[var(--text)]">
              <div>
                <h2 className="text-2xl font-bold text-[var(--primary)] mb-1">
                  {service.title}
                </h2>
                {service.ratingCount > 0 && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm mb-1">
                    <Star size={14} fill="currentColor" />
                    <span className="font-semibold">{service.rating.toFixed(1)}</span>
                    <span className="text-[var(--text-muted)]">({service.ratingCount} {service.ratingCount === 1 ? "avaliação" : "avaliações"})</span>
                  </div>
                )}
                <p className="text-[var(--text-muted)] leading-relaxed">
                  {service.description_service}
                </p>
                {service.provider?.id && (
                  <button
                    onClick={() => { onClose(); navigate(providerPath(service.provider)); }}
                    className="mt-2 text-sm text-[var(--primary)] hover:underline"
                  >
                    Prestador: {providerName}
                    {service.provider?.verified && (
                      <span className="ml-2 text-xs text-green-500" title="Documento de identidade conferido pela equipe do Hire">✓ Verificado</span>
                    )}
                  </button>
                )}
                {!!service.provider?.lateCancellations && (
                  <span className="mt-2 ml-3 text-xs text-amber-500" title="Cancelamentos de pedidos aceitos depois do prazo, nos últimos 12 meses">
                    {service.provider.lateCancellations} cancelamento(s) em cima da hora
                  </span>
                )}
                {!window.location.pathname.startsWith("/service/") && (
                  <button
                    onClick={() => { onClose(); navigate(`/service/${service.id}`); }}
                    className="mt-2 ml-4 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] underline"
                  >
                    Página do serviço (para compartilhar)
                  </button>
                )}
              </div>

              {/* Informações gerais */}
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <Info label="Categoria" value={service.category?.name} />
                <Info label="Subcategoria" value={service.subcategory} />
                <Info label="Preço" value={displayServicePrice({ ...service, packages })} />
                <Info label="Duração" value={service.duration} />
                <Info
                  label="Negociável"
                  value={service.negotiable ? "Sim" : "Não"}
                />
                <Info
                  label="Agendamento"
                  value={service.requiresScheduling ? "Sim" : "Não"}
                />
                {service.requiresScheduling && service.cancellationNotice && (
                  <Info label="Cancelamento" value={service.cancellationNotice} spanFull />
                )}

              </div>

              {/* ----------------------- Ações ----------------------- */}
              {isOwner ? (
              <div className="flex gap-3 mt-4">
                <p className="flex-1 text-sm text-[var(--text-muted)] self-center">Este serviço é seu. É assim que os clientes o veem.</p>
                {onEdit && (
                  <button
                  onClick={onEdit}
                  className="flex items-center justify-center gap-2 border border-[var(--primary)] text-[var(--text)] font-semibold py-3 px-5 rounded-xl hover:bg-[var(--primary)] hover:text-white transition-all">
                    <Pencil size={18} /> Editar
                  </button>
                )}
              </div>
              ) : !service.active ? (
              <p className="mt-4 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                Este serviço está pausado pelo prestador e não recebe pedidos no momento.
                {service.provider?.id && (
                  <button onClick={() => { onClose(); navigate(providerPath(service.provider)); }} className="ml-1 text-[var(--primary)] underline">
                    Ver outros serviços de {providerName}
                  </button>
                )}
              </p>
              ) : confirming ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
              >
                <p className="font-semibold">
                  {confirming === "hire" ? "Confirmar contratação?" : "Confirmar que o serviço foi concluído?"}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {confirming === "hire"
                    ? `${service.title} com ${providerName}. O prestador recebe o pedido e confirma.`
                    : `Confirme só se ${providerName} realmente terminou. Depois você poderá avaliar o prestador.`}
                </p>
                {confirming === "hire" && packages.length > 0 && (
                  <fieldset className="mt-3 flex flex-col gap-2">
                    <legend className="text-sm font-semibold mb-2">Escolha o pacote</legend>
                    {packages.map((pk, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${pkgIndex === i ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                        <input type="radio" name="pkg" checked={pkgIndex === i} onChange={() => setPkgIndex(i)} className="mt-1 accent-[var(--primary)]" />
                        <span className="flex-1">
                          <span className="flex justify-between gap-2 font-medium"><span>{pk.name}</span><span>{formatCurrency(pk.price)}</span></span>
                          {pk.description && <span className="block text-xs text-[var(--text-muted)]">{pk.description}</span>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {confirming === "hire" && !packages.length && needsQuantity(service.priceUnit) && (
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="text-sm font-semibold">Quantas {qtyUnit}?</span>
                    <input
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ""))}
                      placeholder={service.priceUnit === "m2" ? "Ex.: 40" : "Ex.: 3"}
                      className="p-2 w-40 rounded-lg bg-[var(--bg-light)] border border-[var(--border)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">{formatServicePrice(service.price, service.priceUnit)}</span>
                  </label>
                )}
                {confirming === "hire" && (
                  <p className="mt-3 text-sm">
                    Total: <strong>{hireTotal != null ? formatCurrency(hireTotal) : "—"}</strong>
                  </p>
                )}
                {confirming === "hire" && service.requiresScheduling && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold mb-2">Escolha o horário de início</p>
                    {agenda ? <SlotPicker slots={service.scheduleSlots} agenda={agenda} value={slot} onChange={setSlot} /> : <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />}
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setConfirming(null)} disabled={busy} className="flex-1 py-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-light)] transition">
                    Voltar
                  </button>
                  <button
                    onClick={confirming === "hire" ? handleNegociar : handleConcluir}
                    disabled={busy || (confirming === "hire" && ((service.requiresScheduling && !slot) || hireTotal == null))}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 rounded-xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all disabled:opacity-70">
                    {busy && <Loader2 size={18} className="animate-spin" />}
                    Confirmar
                  </button>
                </div>
              </motion.div>
              ) : hasHire ?
              <div className="flex flex-col gap-3 mt-4">
                <p className="text-sm text-[var(--text-muted)]">
                  Sua contratação: <strong className="text-[var(--text)]">{HIRE_STAGE_LABEL[stage!]}</strong>
                </p>
                <div className="flex gap-3">
                {stage === "delivered" ? (
                  <button
                  onClick={() => setConfirming("conclude")}
                  className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 rounded-xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all">
                    <Handshake size={18} />Marcar como concluído
                  </button>
                ) : (
                  <button
                  onClick={() => { onClose(); navigate("/hires"); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 rounded-xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all">
                    <Handshake size={18} />Acompanhar contratação
                  </button>
                )}
                <button
                  onClick={handleMensagem}
                  className="flex-1 flex items-center justify-center gap-2 border border-[var(--primary)] text-[var(--text)] font-semibold py-3 rounded-xl hover:bg-[var(--primary)] hover:text-[var(--bg-light)] hover:scale-[1.02] hover:shadow-lg transition-all">
                  <MessageCircle size={18} />
                  Mensagem
                </button>
                </div>
              </div> :
              <div className="flex flex-col gap-3 mt-4">
                {stage === "done" && !reviewed && (
                  <button
                    onClick={() => setReviewOpen(true)}
                    className="flex items-center justify-center gap-2 border border-yellow-400/60 text-[var(--text)] font-semibold py-2 rounded-xl hover:bg-yellow-400/10 transition-all">
                    <Star size={18} className="text-yellow-400" /> Avaliar {providerName}
                  </button>
                )}
              {quoteOnly ? (
              <div className="flex gap-3">
                {/* "a partir de" / "sob orçamento": o preço sai da conversa, não há contratação direta */}
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 rounded-xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all">
                  <Handshake size={18} />
                  Pedir orçamento
                </button>
                <button
                  onClick={handleMensagem}
                  className="flex-1 flex items-center justify-center gap-2 border border-[var(--primary)] text-[var(--text)] font-semibold py-3 rounded-xl hover:bg-[var(--primary)] hover:text-[var(--bg-light)] hover:scale-[1.02] hover:shadow-lg transition-all">
                  <MessageCircle size={18} />
                  Mensagem
                </button>
              </div>
              ) : (
              <div className="flex gap-3">
                <button
                onClick={() => setConfirming("hire")}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 rounded-xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all">
                  <Handshake size={18} />
                  {stage === "done" ? "Contratar novamente" : "Contratar"}
                </button>
                <button
                  onClick={service.negotiable ? () => setQuoteOpen(true) : handleMensagem}
                  className="flex-1 flex items-center justify-center gap-2 border border-[var(--primary)] text-[var(--text)] font-semibold py-3 rounded-xl hover:bg-[var(--primary)] hover:text-[var(--bg-light)] hover:scale-[1.02] hover:shadow-lg transition-all">
                  <MessageCircle size={18} />
                  {service.negotiable ? "Negociar" : "Mensagem"}
                </button>
              </div>
              )}
              {service.negotiable && !quoteOnly && (
                <button onClick={handleMensagem} className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] self-center">
                  Só quer tirar uma dúvida? Envie uma mensagem
                </button>
              )}
              </div>
              }
            </div>
          </motion.div>

          {/* ----------------------- Modal de imagens ----------------------- */}
          <ImageGalleryModal
            images={images}
            open={imageModalOpen}
            onClose={() => setImageModalOpen(false)}
            startIndex={currentIndex}
          />

          <ChatInbox isOpen={!!chatId} initialConversationId={chatId} onClose={() => setChatId(null)} />

          <ServiceNegotiationModal
            isOpen={quoteOpen}
            onClose={() => setQuoteOpen(false)}
            service={{ id: service.id, title: service.title, providerName }}
          />

          {myHire && (
            <ReviewModal
              open={reviewOpen}
              onClose={() => setReviewOpen(false)}
              hireId={myHire.id}
              targetName={providerName}
              serviceTitle={service.title}
              targetRole="provider"
              onDone={() => setReviewed(true)}
            />
          )}


        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------------------------------------------------
 * Subcomponente Info (rótulo + valor)
 * -------------------------------------------------------------------------- */
function Info({
  label,
  value,
  spanFull = false,
}: {
  label: string;
  value?: string;
  spanFull?: boolean;
}) {
  return (
    <div className={`${spanFull ? "col-span-2" : ""}`}>
      <span className="font-semibold">{label}: </span>
      <span className="text-[var(--text-muted)]">
        {value !== "" ? value : "-"}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Modal de Galeria de Imagens (fullscreen)
 * -------------------------------------------------------------------------- */
function ImageGalleryModal({
  images,
  open,
  onClose,
  startIndex = 0,
}: {
  images: string[];
  open: boolean;
  onClose: () => void;
  startIndex?: number;
}) {
  const [index, setIndex] = useState(startIndex);
  const [dir, setDir] = useState(0);

  useEffect(() => setIndex(startIndex), [startIndex]);

  const next = () => {
    setDir(1);
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prev = () => {
    setDir(-1);
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            onClick={onClose}
            aria-label="Fechar galeria"
            className="absolute top-4 right-4 text-white hover:text-[var(--primary)]"
          >
            <X size={26} />
          </button>

          <AnimatePresence custom={dir} mode="wait">
            <motion.img
              key={index}
              src={images[index]}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-lg"
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5 }}
            />
          </AnimatePresence>

          {/* Controles */}
          <button
            onClick={prev}
            className="absolute left-6 text-white hover:text-[var(--primary)] transition"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={next}
            className="absolute right-6 text-white hover:text-[var(--primary)] transition"
          >
            <ChevronRight size={32} />
          </button>

          {/* Indicadores */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {images.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i === index
                    ? "bg-[var(--primary)] scale-125"
                    : "bg-white/40"
                } transition-all`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
