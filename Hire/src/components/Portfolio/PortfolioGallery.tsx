import { useState } from "react";
import { Images } from "lucide-react";
import ImageLightbox, { type LightboxState } from "../Common/ImageLightbox";
import { uploadUrl } from "../../utils/avatar";
import type { PortfolioItem } from "../../interfaces/Entities";

/* --------------------------------------------------------------------------
 * PortfolioGallery — trabalhos realizados no perfil público do prestador.
 * Grade responsiva, imagens com lazy loading; toque abre em tela cheia.
 * Não aparece quando o prestador ainda não tem itens.
 * -------------------------------------------------------------------------- */
export default function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  if (!items.length) return null;
  const photos = items.map((i) => uploadUrl(i.imageUrl) ?? i.imageUrl);
  const captions = items.map((i) => (i.description ? `${i.title} — ${i.description}` : i.title));

  return (
    <section aria-labelledby="portfolio-title" className="mt-10">
      <h2 id="portfolio-title" className="text-xl font-semibold flex items-center gap-2 mb-4">
        <Images size={20} className="text-[var(--primary)]" /> Portfólio
        <span className="text-sm font-normal text-[var(--text-muted)]">({items.length})</span>
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              onClick={() => setLightbox({ photos, captions, index: i })}
              className="group w-full text-left rounded-2xl overflow-hidden bg-[var(--bg-light)] border border-[var(--border)] hover:border-[var(--primary)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={photos[i]}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-3">
                <div className="font-medium text-sm line-clamp-1">{item.title}</div>
                {item.service && <div className="text-xs text-[var(--text-muted)] line-clamp-1">{item.service.title}</div>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <ImageLightbox state={lightbox} onChange={setLightbox} label="Portfólio" />
    </section>
  );
}
