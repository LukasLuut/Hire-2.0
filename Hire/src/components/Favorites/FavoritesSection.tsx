import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { serviceAPI, serviceImages, type ServiceData } from "../../api/ServiceAPI";
import ServiceDetail from "../ServiceGallery/ServiceDetail/ServiceDetail";
import { displayServicePrice } from "../../utils/price";

/* --------------------------------------------------------------------------
 * FavoritesSection — serviços curtidos pelo cliente.
 * Aberto pelo botão "Favoritos" da página inicial (dentro de um painel);
 * cada card abre o detalhe do serviço, onde dá para contratar de novo ou
 * tirar dos favoritos.
 * -------------------------------------------------------------------------- */
export default function FavoritesSection() {
  const [items, setItems] = useState<ServiceData[] | null>(null);
  const [selected, setSelected] = useState<ServiceData | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return setItems([]);
    try {
      setItems(await serviceAPI.favorites(token));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Loader2 size={16} className="animate-spin" /> Carregando favoritos…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <Heart size={32} className="mx-auto mb-2 opacity-60" />
        <p className="font-medium text-[var(--text)]">Você ainda não tem favoritos</p>
        <p className="text-sm mt-1">Toque no coração de um serviço para guardar aqui.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-2xl overflow-hidden bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--primary)] transition flex"
            >
              <div className="relative w-28 shrink-0">
                <img src={serviceImages(s)[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                {!s.active && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-xs">Indisponível</span>
                )}
              </div>
              <div className="p-3 min-w-0">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{s.provider?.companyName || s.provider?.professionalName}</div>
                <div className="text-sm mt-1">{displayServicePrice(s)}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <ServiceDetail
          service={selected}
          images={serviceImages(selected)}
          isOpen
          onClose={() => {
            setSelected(null);
            load(); // pode ter descurtido
          }}
        />
      )}
    </>
  );
}
