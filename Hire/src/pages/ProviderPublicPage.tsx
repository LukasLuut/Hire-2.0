import { useCallback, useEffect, useState } from "react";
import { rememberProfileOrigin, track, trackView } from "../utils/analytics";
import PortfolioGallery from "../components/Portfolio/PortfolioGallery";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Flag } from "lucide-react";
import ReportModal from "../components/Reports/ReportModal";
import ProviderHero from "../components/ProviderHero/ProviderHero";
import ReviewsSection from "../components/Reviews/ReviewsSection";
import ChatInbox from "../components/Chat/ChatInbox";
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
export default function ProviderPublicPage() {
  const { id, slug } = useParams();
  const key = slug ?? id ?? "";
  const navigate = useNavigate();
  const location = useLocation();
  const { provider: me, token } = useSession();
  const [reportOpen, setReportOpen] = useState(false);
  const { showToast } = useToast();
  const [provider, setProvider] = useState<ProviderEntity | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);

  const providerId = provider?.id ?? 0;
  const isMe = !!me && me.id === providerId;

  useEffect(() => {
    setProvider(null);
    setError(null);
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
      .catch((err) => setError(getErrorMessage(err, "Prestador não encontrado.")));
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
      setChatId(conv.id);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível abrir a conversa."), "error");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 px-6 text-center text-[var(--text)]">
        <p className="text-xl font-semibold">{error}</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">O endereço pode estar errado ou o perfil não existe mais.</p>
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
        <div className="flex justify-end">
          {isMe ? (
            <button onClick={() => navigate("/business")} className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-light)] transition">
              Este é o seu perfil — ir para o painel
            </button>
          ) : (
            <button
              onClick={openChat}
              className="px-2 md:px-4 py-2 border min-h-12 flex gap-2 items-center border-[var(--border)] rounded-lg hover:bg-[var(--bg-light)] transition"
            >
              <MessageSquare size={20} /> {token ? "Chat com o prestador" : "Entrar para conversar"}
            </button>
          )}
        </div>

        <ProviderHero provider={provider} readOnly services={services} />

        <PortfolioGallery items={provider.portfolio ?? []} />

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

      <ChatInbox isOpen={!!chatId} initialConversationId={chatId} onClose={() => setChatId(null)} />
    </div>
  );
}
