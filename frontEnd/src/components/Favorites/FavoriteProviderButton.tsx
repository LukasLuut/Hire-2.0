import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { providerApi } from "../../api/ProviderAPI";
import { useSession } from "../../context/SessionContext";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";

/** Guardar o prestador nos favoritos: botão só com ícone, ao lado de Compartilhar (some para visitantes e para o dono). */
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

  const label = favorite ? "Remover dos favoritos" : "Favoritar";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      className={`w-14 min-h-14 shrink-0 rounded-lg border flex items-center justify-center transition active:scale-95 disabled:opacity-60
        ${favorite ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-light)] hover:text-red-500"}`}
    >
      <Heart size={20} fill={favorite ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
