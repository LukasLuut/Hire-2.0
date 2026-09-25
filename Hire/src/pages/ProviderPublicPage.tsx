import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
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
 * Perfil público do prestador (/provider/:id) — aberto por "Ver perfil".
 * Mesmo hero do painel do prestador, sem edição, com serviços e avaliações.
 * -------------------------------------------------------------------------- */
export default function ProviderPublicPage() {
  const { id } = useParams();
  const providerId = Number(id);
  const navigate = useNavigate();
  const { provider: me } = useSession();
  const { showToast } = useToast();
  const [provider, setProvider] = useState<ProviderEntity | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);

  const isMe = me?.id === providerId;

  useEffect(() => {
    setProvider(null);
    setError(null);
    providerApi
      .getPublic(providerId)
      .then((p) => {
        setProvider(p);
        setServices((p.services ?? []).map((s) => toServiceData(s)));
      })
      .catch((err) => setError(getErrorMessage(err, "Prestador não encontrado.")));
  }, [providerId]);

  const loadReviews = useCallback(() => reviewAPI.forProvider(providerId), [providerId]);

  const openChat = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
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
        <button onClick={() => navigate("/home")} className="mt-4 px-4 py-2 rounded-lg bg-[var(--primary)] text-white">
          Voltar para a busca
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
              <MessageSquare size={20} /> Chat com o prestador
            </button>
          )}
        </div>

        <ProviderHero provider={provider} readOnly services={services} />

        {provider.publicReviews !== false && (
          <ReviewsSection
            title="Avaliações"
            load={loadReviews}
            emptyText="Este prestador ainda não recebeu avaliações."
          />
        )}
      </div>

      <ChatInbox isOpen={!!chatId} initialConversationId={chatId} onClose={() => setChatId(null)} />
    </div>
  );
}
