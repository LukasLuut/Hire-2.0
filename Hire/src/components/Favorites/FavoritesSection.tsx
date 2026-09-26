import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { serviceAPI, serviceImages, type ServiceData } from "../../api/ServiceAPI";
import ServiceDetail from "../ServiceGallery/ServiceDetail/ServiceDetail";
import { displayServicePrice } from "../../utils/price";

/* --------------------------------------------------------------------------
 * FavoritesSection — serviços curtidos pelo cliente, na Home.
 * Aparece só quando há favoritos; cada card abre o detalhe do serviço,
 * onde dá para contratar de novo ou tirar dos favoritos.
 * -------------------------------------------------------------------------- */
export default function FavoritesSection() {
  const [items, setItems] = useState<ServiceData[] | null>(null);
  const [selected, setSelected] = useState<ServiceData | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setItems(await serviceAPI.favorites(token));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="favorites-title" className="w-full max-w-7xl mx-auto px-5 md:px-8 pt-8 pb-2 text-[var(--text)]">
      <div className="flex items-center gap-2 mb-4">
        <Heart size={20} className="text-[var(--primary)]" fill="currentColor" />
        <h2 id="favorites-title" className="text-xl font-semibold">Seus favoritos</h2>
        <span className="text-sm text-[var(--text-muted)]">({items.length})</span>
      </div>
      <ul className="flex gap-4 overflow-x-auto pb-3 snap-x">
        {items.map((s) => (
          <li key={s.id} className="snap-start shrink-0 w-64">
            <button
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-2xl overflow-hidden bg-[var(--bg-light)] border border-[var(--border)] hover:border-[var(--primary)] transition"
            >
              <div className="relative h-32">
                <img src={serviceImages(s)[0]} alt="" className="w-full h-full object-cover" />
                {!s.active && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-xs">Pausado</span>
                )}
              </div>
              <div className="p-3">
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
    </section>
  );
}
