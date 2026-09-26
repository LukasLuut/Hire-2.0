import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { providerApi } from "../../api/ProviderAPI";
import { useSession } from "../../context/SessionContext";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";

/** Guardar o prestador nos favoritos (perfil público; some para visitantes e para o próprio dono). */
export default function FavoriteProviderButton({ providerId }: { providerId: number }) {
  const { token, provider } = useSession();
  const { showToast } = useToast();
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // o perfil público não expõe o dono: compara com o perfil profissional da sessão
  const own = provider?.id === providerId;

  useEffect(() => {
    if (!token || own) return;
    providerApi.isFavorite(providerId, token).then((r) => setFavorite(!!r?.favorite)).catch(() => setFavorite(false));
  }, [providerId, token, own]);

  if (!token || own || favorite === null) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await providerApi.toggleFavorite(providerId, token);
      setFavorite(!!r?.favorite);
      showToast(r?.favorite ? "Prestador salvo nos favoritos." : "Prestador removido dos favoritos.", "success");
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível atualizar os favoritos."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorite}
      className={`px-3 py-1 rounded-full text-xs sm:text-sm border flex items-center gap-1.5 transition disabled:opacity-60
        ${favorite ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] hover:border-[var(--primary)]"}`}
    >
      <Heart size={14} fill={favorite ? "currentColor" : "none"} aria-hidden />
      {favorite ? "Favorito" : "Favoritar"}
    </button>
  );
}
