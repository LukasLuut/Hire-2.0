/* --------------------------------------------------------------------------
 * ProfilePage.tsx
 *
 * Página de perfil (rota /home) com:
 *  - Hero do perfil: avatar (DiceBear), nome, nota real, Sobre, ações
 *  - Edição no próprio hero (lápis entra/salva, Esc cancela)
 *  - Cadastro de empresa (prestador), Chat (negociações)
 *  - Busca de serviços e avaliações recebidas como cliente
 * -------------------------------------------------------------------------- */
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Star, Edit3, MessageSquare, Check } from "lucide-react";
// o cadastro de prestador traz o mapa (leaflet): só é baixado quando o formulário abre
const ProviderRegistrationContainer = lazy(() => import("../components/ProviderRegistration/ProviderRegistration/Principal/ProviderRegistrationContainer"));
import { useNavigate, useSearchParams } from "react-router-dom";
import { userAPI } from "../api/UserAPI";
import { reviewAPI } from "../api/ReviewAPI";
import ServiceDashboardSophisticated from "./DashboardClient";
import ProfileCardSkeleton from "../skeletons/ProfileCardSkeleton";
import { useToast } from "../components/Toast/ToastContext"
import { useSession } from "../context/SessionContext";
import ChatInbox from "../components/Chat/ChatInbox";
import ConfirmModal from "../components/Common/ConfirmModal";
import ReviewsSection from "../components/Reviews/ReviewsSection";
import FavoritesSection from "../components/Favorites/FavoritesSection";
import { defaultAvatar } from "../utils/avatar";
import { getErrorMessage } from "../utils/errors";
import type { RatingStats } from "../interfaces/Entities";

/* --------------------------------------------------------------------------
 * COMPONENTE PRINCIPAL
 * -------------------------------------------------------------------------- */
export default function ProfilePage() {
  /* ------------------------------------------------------------------------
   * ESTADOS
   * ------------------------------------------------------------------------ */
  const { user: sessionUser, provider, loading, refresh, logout } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOpenChat, setIsOpenChat]=useState(false)
  const [registration, setRegistration]=useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rating, setRating] = useState<RatingStats>({ average: 0, count: 0 });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();

  // Cópia editável dos dados do usuário (a sessão guarda o valor salvo)
  const [user, setUser] = useState({ id: 0, name: "", email: "", about: "" });

  useEffect(() => {
    if (sessionUser && !isEditing) {
      setUser({ id: sessionUser.id, name: sessionUser.name ?? "", email: sessionUser.email ?? "", about: sessionUser.about ?? "" });
    }
  }, [sessionUser, isEditing]);

  // Nota do usuário como cliente (avaliações feitas pelos prestadores)
  const loadClientReviews = useCallback(() => reviewAPI.forClient(sessionUser!.id), [sessionUser]);
  useEffect(() => {
    if (!sessionUser) return;
    reviewAPI.forClient(sessionUser.id).then(({ average, count }) => setRating({ average, count })).catch(() => {});
  }, [sessionUser]);

  // /home?prestador=1 abre direto o cadastro de empresa
  useEffect(() => {
    if (params.get("prestador") && !loading && !provider) setRegistration(true);
  }, [params, loading, provider]);

   // Fecha com ESC: cancela a edição e desfaz o que foi digitado
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsEditing(false);
        showToast("Edição cancelada", "info")
      }
    }

    if (isEditing) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isEditing, showToast]);

  /* ------------------------------------------------------------------------
   * FUNÇÕES DE EDIÇÃO
   * - 1º clique no lápis: entra em edição; 2º clique: salva
   * ------------------------------------------------------------------------ */
  const handleEditToggle = () => {
    if (isEditing) handleUpdate();
    else setIsEditing(true);
  }

  const handleUpdate = async () => {
    const token = localStorage.getItem("token")
    if(!token) return;

    if (!user.name.trim()) return showToast("Informe seu nome", "warning");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return showToast("Informe um e-mail válido", "warning");

    setSaving(true);
    try {
      await userAPI.updateProfile(token, { name: user.name.trim(), about: user.about.trim(), email: user.email.trim() });
      await refresh();
      setIsEditing(false);
      showToast("Informações editadas com sucesso!", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível salvar. Tente novamente."), "error");
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = async () => {
    const token = localStorage.getItem("token")
    if(!token) return;

    setDeleting(true);
    try {
      await userAPI.deleteUser(token);
      showToast("Usuário deletado com sucesso!", "success");
      logout();
      navigate('/auth')
    } catch (err) {
      showToast(getErrorMessage(err, "Erro inesperado"), "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const closeRegistration = () => {
    setRegistration(false);
    if (params.get("prestador")) setParams({}, { replace: true });
  };

  const aboutPlaceholder = "Fale um pouco sobre você... Por exemplo: ''Sou uma pessoa dedicada, sempre em busca de aprendizado e novas experiências. Gosto de colaborar, compartilhar conhecimento e enfrentar desafios que contribuam para meu crescimento pessoal e profissional.''";

  /* ------------------------------------------------------------------------
   * RENDERIZAÇÃO
   * ------------------------------------------------------------------------ */
  return (
    <div className="min-h-screen pt-15 sm:pt-20 bg-[var(--bg-dark)] text-[var(--text)] transition-colors duration-300">

      {/* ===============================================================
       * SEÇÃO HERO / CABEÇALHO DO PERFIL
       * =============================================================== */}
       { loading || !sessionUser ?
       <ProfileCardSkeleton/> :
      <section className="relative flex flex-col md:flex-row items-center justify-center gap-6 bg-[var(--bg-dark)] p-8">
        {/* IMAGEM DE PERFIL */}
        <div className="relative">
          <img
            src={defaultAvatar(sessionUser.email || sessionUser.name)}
            alt={`Foto de perfil de ${user.name}`}
            className="w-70 h-70 rounded-full border-4 border-[var(--primary)] object-cover"
          />

          {/* BOTÃO DE EDIÇÃO */}
          <button
            onClick={handleEditToggle}
            disabled={saving}
            className="absolute bottom-1 right-0 bg-[var(--primary)] text-white rounded-full p-2"
            title={isEditing ? "Salvar alterações" : "Editar perfil"}
            aria-label={isEditing ? "Salvar alterações" : "Editar perfil"}
          >
            {isEditing ? <Check size={18}/> : <Edit3 size={18}/>}
          </button>
        </div>

        {/* INFORMAÇÕES PRINCIPAIS DO PERFIL */}
        <div>
          {/* NOME + AVALIAÇÃO */}
          <div className="flex items-center gap-4 flex-wrap">
            {isEditing ? (
              <input
                value={user.name}
                aria-label="Nome"
                onChange={(e) => setUser((prev) => ({...prev, name: e.target.value}))}
                className="bg-[var(--bg-light)] border border-[var(--primary)] rounded-lg px-2 py-1 text-2xl"
              />
            ) : (
              <h1 className="text-4xl font-bold">{user.name}</h1>
            )}
            {isEditing && (
              <button className="px-2 py-2 text-md bg-red-700 rounded-md text-white" onClick={() => setConfirmDelete(true)}>Excluir Usuário</button>
            )}

            <div className="flex items-center md:flex-row flex-col gap-1 text-yellow-400">
              <div className="flex flex-row">
                <Star size={20} fill={rating.count > 0 ? "currentColor" : "none"} />
              <span className="font-semibold">
                {rating.count > 0 ? rating.average.toFixed(1) : "Novo"}
              </span>
              </div>
              <span className="text-[var(--text-muted)] text-sm">
                ({rating.count} {rating.count === 1 ? "avaliação" : "avaliações"})
              </span>
            </div>
          </div>

          {/* CAIXA DE EDIÇÃO */}
            {/* BIO / SOBRE */}
          <section className="p-5 pb-10 flex flex-col md:px-5">
            <h2 className="text-xl font-semibold mb-2">Sobre</h2>
            {isEditing ? (
              <textarea
                value={user.about}
                aria-label="Sobre você"
                placeholder="Fale um pouco sobre você..."
                onChange={(e) => setUser((prev) => ({...prev, about: e.target.value}))}
                className="md:w-2xl w-xs bg-[var(--bg-light)] border border-[var(--primary)] rounded-lg p-2 text-[var(--text)] resize-none h-32"
              />
            ) : (
              <p className="text-[var(--text-muted)] max-w-2xl">{!user.about ? aboutPlaceholder : user.about}</p>
            )}
            {isEditing && (
              <input
              className=" bg-[var(--bg-light)] mt-5 border border-[var(--primary)] rounded-lg p-2 text-[var(--text)] resize-none h-8"
              value={user.email}
              aria-label="E-mail"
              onChange={(e) => setUser((prev) => ({...prev, email: e.target.value}))}
              placeholder="Email"
              />
            )}
          </section>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-end gap-4 mt-2">
             {(!registration && !provider) && (
              <button className="bg-[var(--primary)] rounded-xl w-55 h-15 mt-6 text-lg text-white animate-bounce "
                onClick={()=>setRegistration(true) }>
                Cadastre sua empresa
              </button>
            )}
             <button
                onClick={()=>{setIsOpenChat(true)}}
                className="px-2 md:px-4 py-2 border min-h-14 bottom-0 flex gap-2 items-center border-[var(--border)] rounded-lg hover:bg-[var(--bg-light)] transition">
              <MessageSquare size={20} /> Chat
            </button>
          </div>
        </div>
      </section>
      }
      {/* ===============================================================
       * SEÇÃO DO CHAT (conversas e negociações)
       * =============================================================== */}
      <ChatInbox isOpen={isOpenChat} onClose={() => setIsOpenChat(false)} />

        {/* ===============================================================
       * SEÇÃO DE REGISTRO E GALERIA DE SERVIÇOS
       * =============================================================== */}
         {registration&&(
           <Suspense fallback={null}><ProviderRegistrationContainer
             isOpen={registration}
             onClose={closeRegistration}
             onDone={() => navigate("/business")}
           /></Suspense>
         )}

          <div className="flex flex-col items-center justify-center min-h-50 bg-[var(--bg-dark)] border-b-1  border-[var(--border)] text-[var(--text)]">

            {!registration&&(<FavoritesSection />)}
            {!registration&&(<ServiceDashboardSophisticated />)}

          </div>

      {/* ===============================================================
       * SEÇÃO DE AVALIAÇÕES (recebidas como cliente)
       * =============================================================== */}
      {sessionUser && !registration && (
        <ReviewsSection
          title="Avaliações"
          load={loadClientReviews}
          emptyText="Você ainda não recebeu avaliações. Depois de concluir uma contratação, o prestador pode avaliar você."
        />
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Excluir sua conta?"
        description="Seus dados e seu perfil de prestador (se houver) serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir conta"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
