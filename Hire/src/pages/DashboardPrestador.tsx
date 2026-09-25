import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import ProviderHero from "../components/ProviderHero/ProviderHero";
import {
  Star,
  Plus,
  MessageSquare,
  Archive,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import ServiceEditor from "../components/ServiceEditor/ServiceEditor";
import ServiceResponseModal from "../components/Negotiation/ServiceResponseModal";
import { useNavigate } from "react-router-dom";
import ChatInbox from "../components/Chat/ChatInbox";
import { ProviderProfileSkeleton } from "../skeletons/ProviderProfileSkeleton/ProviderProfileSkeleton";
import { useSession } from "../context/SessionContext";
import { hireAPI } from "../api/HireAPI";
import { reviewAPI } from "../api/ReviewAPI";
import { conversationAPI } from "../api/ConversationAPI";
import type { ConversationSummary, HireEntity, ReviewEntity } from "../interfaces/Entities";
import { HIRE_STAGE_LABEL_PROVIDER, getHireStage } from "../utils/hireStatus";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";
import { uploadUrl } from "../utils/avatar";
import { getFirstAndLastName } from "../utils/nameUtils";

// nome curto (primeiro e último) nos cartões estreitos do painel
const short = (name: string | undefined, fallback: string) => getFirstAndLastName(name ?? "") || fallback;

type Notification = { id: string; text: string; date: number };

/* ---------------------------
   Component
   --------------------------- */
export default function DashboardPrestador() {
  const { provider, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  // data (tudo vem da API)
  const [bookings, setBookings] = useState<HireEntity[] | null>(null);
  const [reviews, setReviews] = useState<ReviewEntity[] | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isOpenChat, setIsOpenChat]=useState(false);
  const [galleryKey, setGalleryKey] = useState(0);
  const [responding, setResponding] = useState<number | null>(null);

  // mobile accordion (drawer alternative per sua escolha 'b')
  const [panelOpen, setPanelOpen] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !provider?.id) return;
    const [hs, rv, cv] = await Promise.all([
      hireAPI.getHireByProviderId(provider.id).catch(() => []),
      reviewAPI.forProvider(provider.id).catch(() => null),
      conversationAPI.list(token).catch(() => []),
    ]);
    setBookings(hs);
    setReviews(rv?.reviews ?? []);
    setConversations(cv.filter((c) => c.myRole === "prestador"));
  }, [provider?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Quem ainda não é prestador volta para o perfil (onde pode cadastrar a empresa)
  useEffect(() => {
    if (!sessionLoading && !provider) navigate("/home", { replace: true });
  }, [sessionLoading, provider, navigate]);

  // Notificações recentes: novos pedidos, avaliações e mensagens de clientes
  // Pedidos de orçamento aguardando resposta
  const pendingRequests = conversations.filter((c) => c.status === "OPEN" && c.requestStatus === "PENDENTE");

  const notifications: Notification[] = [
    ...pendingRequests.map((c) => ({ id: `q${c.id}`, text: `Pedido de orçamento — ${short(c.client?.name, "Cliente")} (${c.service?.title ?? "serviço"})`, date: new Date(c.updatedAt).getTime() })),
    ...(bookings ?? [])
      .filter((b) => getHireStage(b) === "requested")
      .map((b) => ({ id: `h${b.id}`, text: `Novo pedido — ${short(b.user?.name, "Cliente")} (${b.service?.title ?? "serviço"})`, date: new Date(b.firstContact).getTime() })),
    ...(reviews ?? []).map((r) => ({ id: `r${r.id}`, text: `Nova avaliação recebida — ${short(r.author?.name, "Cliente")} (${r.rating}★)`, date: new Date(r.createdAt).getTime() })),
    ...conversations
      .filter((c) => c.lastMessage && c.lastMessage.role === "cliente")
      .map((c) => ({ id: `c${c.id}`, text: `Mensagem de ${short(c.client?.name, "cliente")} — ${c.lastMessage!.text}`, date: new Date(c.lastMessage!.createdAt).getTime() })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 4);

  // UI motion variants
  const panelVariant = { closed: { height: 0, opacity: 0 }, open: { height: "auto", opacity: 1 } };
  const[openCreateService, setOpenCreateService]=useState(false)

  /* ---------------------------
     Render
     --------------------------- */
  if (!sessionLoading && !provider) return null;
  const loading = sessionLoading || !provider;

  return (
    <LayoutGroup>
      { loading ?
        <ProviderProfileSkeleton/> :
      <div className="min-h-screen bg-[var(--bg-dark)] pt-25 text-[var(--text)] px-4 sm:px-6 md:px-8 lg:px-10 py-6">
        {/* header */}
        <div className="max-w-[90%] mx-auto flex flex-col lg:flex-row gap-6">
          {/* aside (desktop) visible at right; on mobile it will be an accordion below header */}
          {provider && <ProviderHero key={galleryKey} provider={provider} />}
          <aside className="w-full mt-6 lg:w-80">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=" lg:block hidden md:flex mb-4 bg-[var(--bg-light)]/40 backdrop-blur-xl rounded-2xl p-4 border border-[var(--border)] shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Atalhos</h3>
                <div className="text-xs text-[var(--text-muted)]">Acesso rápido</div>
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={()=>setOpenCreateService(true)} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--primary)]/90 border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                  <Plus /> <span className="text-sm">Novo serviço</span>
                </button>
                <button onClick={()=>{setIsOpenChat(true)}} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                  <MessageSquare /> <span className="text-sm">Mensagens</span>
                </button>
                <button onClick={()=>navigate("/progress")} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                  <Archive /> <span className="text-sm">Relatórios</span>
                </button>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Notificações recentes</h4>
                <div className="flex flex-col gap-2">
                  {notifications.length === 0 && <div className="text-xs text-[var(--text-muted)]">Nenhuma novidade por enquanto.</div>}
                  {notifications.map((n) => (
                    <div key={n.id} className="text-xs text-[var(--text-muted)] line-clamp-2">• {n.text}</div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* mobile accordion panel (option b) */}
            <div className="lg:hidden mb-4">
              <motion.button
                onClick={() => setPanelOpen((s) => !s)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-[var(--bg)]/40 border border-[var(--border-muted)]">
                    <Plus />
                  </div>
                  <div>
                    <div className="font-medium">Atalhos & Notificações</div>
                    <div className="text-xs text-[var(--text-muted)]">Abrir painel rápido</div>
                  </div>
                </div>

                <div className="text-[var(--text-muted)]">
                  {panelOpen ? <ChevronUp /> : <ChevronDown />}
                </div>
              </motion.button>

              <AnimatePresence>
                {panelOpen && (
                  <motion.div
                    initial="closed"
                    animate="open"
                    exit="closed"
                    variants={panelVariant}
                    transition={{ duration: 0.28 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-4 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border)]">
                      <div className="flex flex-col gap-3">
                        <button onClick={()=>setOpenCreateService(true)} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--primary)] border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                          <Plus /> <span  className="text-sm">Novo serviço</span>
                        </button>
                        <button onClick={()=>{setIsOpenChat(true)}} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                          <MessageSquare /> <span className="text-sm">Mensagens</span>
                        </button>
                        <button onClick={()=>navigate("/progress")} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)] hover:border-[var(--highlight)]">
                          <Archive /> <span className="text-sm">Relatórios</span>
                        </button>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Notificações recentes</h4>
                        <div className="flex flex-col gap-2 text-xs text-[var(--text-muted)]">
                          {notifications.length === 0 && <div>Nenhuma novidade por enquanto.</div>}
                          {notifications.map((n) => (
                            <div key={n.id} className="line-clamp-2">• {n.text}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div >

            {openCreateService && <ServiceEditor serviceId={null} isOpen={openCreateService} onClose={() => setOpenCreateService(false)} onSaved={() => setGalleryKey((k) => k + 1)} />}
            </div>
            {/* right column inside main (bookings + reviews) */}
            <aside className="lg:col-span-1">
              {pendingRequests.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-[var(--bg-light)]/30 backdrop-blur-xl rounded-2xl p-4 border border-[var(--primary)]/60">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Pedidos de orçamento</h4>
                    <div className="text-xs text-[var(--text-muted)]">{pendingRequests.length} aguardando</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {pendingRequests.slice(0, 4).map((c) => (
                      <div key={c.id} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)]">
                        <FileText size={18} className="text-[var(--primary)] mt-0.5 shrink-0" />
                        <div className="flex-1 text-sm min-w-0">
                          <div className="font-medium">{short(c.client?.name, "Cliente")}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate">{c.service?.title}</div>
                          {c.request?.budget && <div className="text-xs mt-1">Orçamento: {c.request.budget}</div>}
                        </div>
                        <button onClick={() => setResponding(c.id)} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold">
                          Responder
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-light)]/30 backdrop-blur-xl rounded-2xl p-4 border border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Reservas recentes</h4>
                  <div className="text-xs text-[var(--text-muted)]">Próximas</div>
                </div>

                <div className="flex flex-col gap-3">
                  {bookings === null && <div className="h-16 rounded-lg bg-[var(--bg)]/40 animate-pulse" />}
                  {bookings?.length === 0 && (
                    <div className="text-xs text-[var(--text-muted)]">Nenhuma reserva ainda. Quando um cliente contratar seus serviços, ela aparece aqui.</div>
                  )}
                  {(bookings ?? []).slice(0, 4).map((b) => {
                    const svc = b.service;
                    const img = uploadUrl(svc?.imageUrl) ?? `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(svc?.title ?? "servico")}`;
                    return (
                      <div key={b.id} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)]">
                        <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                          <img src={img} alt={svc?.title} className="w-full h-full object-cover" />
                        </div>
                        {/* nome e valor na mesma linha; datas e status sem quebrar no meio */}
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium truncate">{short(b.user?.name, "Cliente")}</span>
                            <span className="font-semibold text-xs whitespace-nowrap">{formatCurrency(b.price)}</span>
                          </div>
                          <div className="text-[var(--text-muted)] text-xs whitespace-nowrap">{b.scheduledAt ? `Agendado: ${formatDateTime(b.scheduledAt)}` : formatDate(b.firstContact)}</div>
                          <div className="text-xs mt-1">{svc?.title}</div>
                          <div className="text-[var(--text-muted)] text-xs mt-0.5">{HIRE_STAGE_LABEL_PROVIDER[getHireStage(b)]}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <button onClick={()=>navigate("/progress")} className="w-full px-3 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold">Ver todas reservas</button>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-[var(--bg-light)]/30 backdrop-blur-xl rounded-2xl p-4 border border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Avaliações recentes</h4>
                  <div className="text-xs text-[var(--text-muted)]">Últimas</div>
                </div>

                <div className="flex flex-col  gap-3">
                  {reviews?.length === 0 && (
                    <div className="text-xs text-[var(--text-muted)]">Você ainda não recebeu avaliações.</div>
                  )}
                  {(reviews ?? []).slice(0, 3).map((r) => (
                    <div key={r.id} className="p-3 rounded-lg bg-[var(--bg)]/40 border border-[var(--border-muted)]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{short(r.author?.name, "Cliente")}</div>
                        <div className="text-yellow-400 text-sm flex items-center gap-1"><Star size={14} fill="currentColor" /> {r.rating.toFixed(1)}</div>
                      </div>
                      {r.comment && <div className="text-xs text-[var(--text-muted)] mt-2">{r.comment}</div>}
                      {r.photos.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {r.photos.slice(0, 4).map((ph) => (
                            <img key={ph.id} src={uploadUrl(ph.url)!} alt="" className="w-10 h-10 rounded object-cover border border-[var(--border)]" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </aside>
          </aside>
        </div>

        {/* CHAT */}
        <ChatInbox isOpen={isOpenChat} onClose={() => { setIsOpenChat(false); load(); }} />
        <ServiceResponseModal isOpen={responding !== null} conversationId={responding} onClose={() => setResponding(null)} onDone={load} />
        {/* main content: services + bookings */}

      </div>
      }
    </LayoutGroup>
  );
}


