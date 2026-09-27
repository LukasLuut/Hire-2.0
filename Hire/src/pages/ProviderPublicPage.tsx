import { useCallback, useEffect, useState } from "react";
import { requestChat } from "../utils/chatEvents";
import ProfileUnavailable from "../components/ProfileUnavailable";
import { providerUrl } from "../utils/providerPath";
import SharePanel from "../components/Share/SharePanel";
import { rememberProfileOrigin, track, trackView } from "../utils/analytics";
import PortfolioGallery from "../components/Portfolio/PortfolioGallery";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Flag, Share2, Handshake } from "lucide-react";
import ServiceNegotiationModal from "../components/Negotiation/ServiceNegotiationModal";
import ConfirmModal from "../components/Common/ConfirmModal";
import { displayServicePrice } from "../utils/price";
import ReportModal from "../components/Reports/ReportModal";
import ProviderHero from "../components/ProviderHero/ProviderHero";
import ReviewsSection from "../components/Reviews/ReviewsSection";
import { ProviderProfileSkeleton } from "../skeletons/ProviderProfileSkeleton/ProviderProfileSkeleton";
import { providerApi } from "../api/ProviderAPI";
import { reviewAPI } from "../api/ReviewAPI";
import { conversationAPI } from "../api/ConversationAPI";
import { toServiceData, type ServiceData } from "../api/ServiceAPI";
import type { ProviderEntity } from "../interfaces/Entities";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * Perfil público do prestador — página profissional aberta sem login.
 * Endereço canônico /prestador/:slug; /provider/:id (links antigos) redireciona.
 * Mesmo hero do painel do prestador, sem edição, com serviços e avaliações.
 * Conversar exige login: quem não entrou vai para /auth e volta para cá.
 * -------------------------------------------------------------------------- */
// mesmo visual dos botões Chat/Favoritos da página inicial
const actionBtn = "px-3 md:px-4 py-2 border min-h-14 flex gap-2 items-center border-[var(--border)] rounded-lg hover:bg-[var(--bg-light)] transition";

export default function ProviderPublicPage() {
  const { id, slug } = useParams();
  const key = slug ?? id ?? "";
  const navigate = useNavigate();
  const location = useLocation();
  const { provider: me, token } = useSession();
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { showToast } = useToast();
  const [provider, setProvider] = useState<ProviderEntity | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  // perfil desativado (410) ou inexistente (404): página própria para o visitante
  const [unavailable, setUnavailable] = useState<"deactivated" | "not_found" | null>(null);
  // Orçamento: escolhe o serviço (quando há mais de um) e abre o pedido de negociação
  const [pickOpen, setPickOpen] = useState(false);
  // picked = null → "Outros" (serviço que o prestador não listou)
  const [picked, setPicked] = useState<ServiceData | null>(null);
  const [quoteService, setQuoteService] = useState<{ id?: number; title: string } | null>(null);

  const providerId = provider?.id ?? 0;
  const isMe = !!me && me.id === providerId;

  useEffect(() => {
    setProvider(null);
    setError(null);
    setUnavailable(null);
    providerApi
      .getPublic(key)
      .then((p) => {
        setProvider(p);
        setServices((p.services ?? []).map((s) => toServiceData(s)));
        trackView("profile_view", { providerId: p.id });
        rememberProfileOrigin(p.id);
        // endereço canônico: /prestador/<slug> (mantém ?ref= e outros parâmetros)
        if (p.slug && location.pathname !== `/prestador/${p.slug}`) {
          navigate(`/prestador/${p.slug}${location.search}`, { replace: true });
        }
      })
      .catch((err) => {
        const status = (err as { status?: number }).status;
        if (status === 410) setUnavailable("deactivated");
        else if (status === 404) setUnavailable("not_found");
        else setError(getErrorMessage(err, "Não foi possível abrir o perfil agora."));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // título da aba (o preview de redes sociais vem do servidor)
  useEffect(() => {
    if (!provider) return;
    const name = provider.companyName || provider.professionalName;
    document.title = `${name}${provider.category?.name ? ` — ${provider.category.name}` : ""}${provider.baseCity ? ` em ${provider.baseCity}` : ""} | Hire.`;
    return () => {
      document.title = "Hire.";
    };
  }, [provider]);

  const loadReviews = useCallback(() => reviewAPI.forProvider(providerId), [providerId]);

  const openChat = async () => {
    if (providerId) track("quote_click", { providerId });
    const token = localStorage.getItem("token");
    if (!token) {
      // sem login: entra e volta para este perfil
      navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    try {
      const conv = await conversationAPI.open({ providerId }, token);
      requestChat(conv.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a conversa."), "error");
    }
  };

  const openQuote = () => {
    if (!token) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (providerId) track("quote_click", { providerId });
    setPicked(services.find((s) => s.negotiable) ?? services[0] ?? null);
    setPickOpen(true);
  };

  if (unavailable) return <ProfileUnavailable reason={unavailable} loggedIn={!!token} />;

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 px-6 text-center text-[var(--text)]">
        <p className="text-xl font-semibold">{error}</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">Verifique sua conexão e tente de novo.</p>
        <button onClick={() => navigate(token ? "/home" : "/")} className="mt-4 px-4 py-2 rounded-lg bg-[var(--primary)] text-white">
          {token ? "Voltar para a busca" : "Conhecer o Hire"}
        </button>
      </div>
    );
  }

  if (!provider) return <ProviderProfileSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] pt-25 text-[var(--text)] px-4 sm:px-6 md:px-8 lg:px-10 py-6">
      <div className="max-w-[90%] mx-auto">
        <ProviderHero
          provider={provider}
          readOnly
          services={services}
          actions={
            <>
              {isMe ? (
                <button onClick={() => navigate("/business")} className={actionBtn}>
                  Ir para o meu painel
                </button>
              ) : (
                <>
                  <button onClick={openChat} className={actionBtn}>
                    <MessageSquare size={20} /> {token ? "Chat" : "Entrar para conversar"}
                  </button>
                  <button onClick={openQuote} className={actionBtn}>
                    <Handshake size={20} className="text-[var(--primary)]" /> Orçamento
                  </button>
                </>
              )}
              <button onClick={() => setShareOpen(true)} className={`${actionBtn} !border-[var(--primary)] bg-[var(--primary)] text-white hover:!bg-[var(--primary)] hover:brightness-110`}>
                <Share2 size={20} /> Compartilhar
              </button>
            </>
          }
        />

        <PortfolioGallery items={provider.portfolio ?? []} />

        {provider.cityPage && (
          <p className="mt-6 text-sm">
            <Link to={provider.cityPage.path} className="text-[var(--primary)] hover:underline">
              Ver mais profissionais de {provider.cityPage.label}
            </Link>
          </p>
        )}

        <SharePanel
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          qrFor={provider.slug ?? provider.id}
          target={{
            url: providerUrl(provider),
            title: provider.companyName || provider.professionalName,
            text: `${provider.companyName || provider.professionalName}${provider.category?.name ? ` — ${provider.category.name}` : ""} no Hire.`,
            providerId: provider.id,
          }}
        />

        {!isMe && token && (
          <div className="flex justify-end mt-2">
            <button onClick={() => setReportOpen(true)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-500">
              <Flag size={14} /> Denunciar perfil
            </button>
          </div>
        )}
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          providerId={provider.id}
          subject={provider.companyName || provider.professionalName || "Prestador"}
        />

        {provider.publicReviews !== false && (
          <ReviewsSection
            title="Avaliações"
            load={loadReviews}
            emptyText="Este prestador ainda não recebeu avaliações."
          />
        )}
      </div>

      {/* celular: ações principais sempre à mão */}
      {!isMe && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 p-3 flex gap-2 bg-[var(--bg-dark)]/95 backdrop-blur border-t border-[var(--border)]">
          <a href="#servicos" className="flex-1 text-center py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">
            Ver serviços
          </a>
          <button onClick={openChat} className="flex-1 py-3 rounded-xl border border-[var(--border)] font-semibold flex items-center justify-center gap-2">
            <MessageSquare size={18} /> {token ? "Conversar" : "Entrar"}
          </button>
        </div>
      )}
      {!isMe && <div className="sm:hidden h-20" aria-hidden />}


      {/* Orçamento: qual serviço? */}
      <ConfirmModal
        open={pickOpen}
        title="Pedir orçamento"
        description="Escolha o serviço. Depois você descreve o que precisa e o prestador responde com uma proposta."
        confirmLabel="Continuar"
        cancelLabel="Voltar"
        onConfirm={() => { setPickOpen(false); setQuoteService(picked ? { id: picked.id, title: picked.title } : { title: "Outro serviço" }); }}
        onClose={() => setPickOpen(false)}
      >
        <ul className="grid gap-2 max-h-[55vh] overflow-y-auto pr-1" role="radiogroup" aria-label="Serviço">
          {services.map((s) => (
            <li key={s.id}>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${picked?.id === s.id ? "border-[var(--primary)] bg-[var(--bg)]" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                <input type="radio" name="quote-service" checked={picked?.id === s.id} onChange={() => setPicked(s)} className="accent-[var(--primary)]" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{s.title}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{displayServicePrice(s)}{s.negotiable ? " · negociável" : ""}</span>
                </span>
              </label>
            </li>
          ))}
          {/* serviço que não está na lista: o pedido vai direto ao prestador */}
          <li>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${!picked ? "border-[var(--primary)] bg-[var(--bg)]" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
              <input type="radio" name="quote-service" checked={!picked} onChange={() => setPicked(null)} className="accent-[var(--primary)]" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Outros</span>
                <span className="block text-xs text-[var(--text-muted)]">O que você precisa não está na lista? Descreva e peça um orçamento.</span>
              </span>
            </label>
          </li>
        </ul>
      </ConfirmModal>

      <ServiceNegotiationModal
        isOpen={!!quoteService}
        onClose={() => setQuoteService(null)}
        service={quoteService ? { id: quoteService.id, title: quoteService.title, providerName: provider.companyName || provider.professionalName, providerId: provider.id } : null}
      />
    </div>
  );
}
