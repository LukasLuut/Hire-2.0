import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import ImageLightbox, { type LightboxState } from "../Common/ImageLightbox";
import { Stars } from "./StarRating";
import { ReviewsSkeleton } from "../../skeletons/ProviderProfileSkeleton/ReviewsSkeleton";
import type { ReviewList } from "../../interfaces/Entities";
import { uploadUrl } from "../../utils/avatar";
import { formatDate } from "../../utils/format";
import { getFirstAndLastName } from "../../utils/nameUtils";

/* --------------------------------------------------------------------------
 * ReviewsSection — avaliações no mesmo card do perfil original
 * (vidro, borda, estrelas amarelas, "— nome"), agora com dados reais e fotos.
 * -------------------------------------------------------------------------- */
interface ReviewsSectionProps {
  title?: string;
  load: () => Promise<ReviewList>;
  emptyText: string;
  /** Muda para recarregar (ex.: depois de enviar uma avaliação) */
  reloadKey?: unknown;
  compact?: boolean;
}

export default function ReviewsSection({ title = "Avaliações", load, emptyText, reloadKey, compact = false }: ReviewsSectionProps) {
  const [data, setData] = useState<ReviewList | null>(null);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const fetchReviews = useCallback(async () => {
    setError(false);
    try {
      setData(await load());
    } catch {
      setError(true);
    }
  }, [load]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, reloadKey]);

  return (
    <section className={compact ? "" : "p-8 md:px-20"}>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <h2 className={compact ? "font-semibold" : "text-2xl font-bold"}>{title}</h2>
        {data && data.count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars value={data.average} />
            <span className="font-semibold">{data.average.toFixed(1)}</span>
            <span className="text-[var(--text-muted)]">
              ({data.count} {data.count === 1 ? "avaliação" : "avaliações"})
            </span>
          </div>
        )}
      </div>

      {error ? (
        <div className="text-[var(--text-muted)]">
          Não foi possível carregar as avaliações.{" "}
          <button onClick={fetchReviews} className="text-[var(--primary)] underline">
            Tentar novamente
          </button>
        </div>
      ) : !data ? (
        <ReviewsSkeleton />
      ) : data.reviews.length === 0 ? (
        <div className="text-[var(--text-muted)]">{emptyText}</div>
      ) : (
        <div className={compact ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
          {data.reviews.map((review) => {
            const photos = review.photos.map((p) => uploadUrl(p.url)!);
            return (
              <motion.div
                key={review.id}
                className="bg-[var(--bg-light)]/20 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-[var(--border)] flex flex-col gap-2"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                {/* Avaliação (estrelas e comentário) */}
                <div className="flex items-center justify-between gap-2">
                  <Stars value={review.rating} />
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(review.createdAt)}</span>
                </div>

                {review.service && <p className="text-xs text-[var(--text-muted)]">{review.service.title}</p>}

                {review.comment && <p className="text-[var(--text-muted)] flex-1">{review.comment}</p>}
                {review.moderated && <p className="text-xs italic text-[var(--text-muted)] flex-1">Comentário removido pela moderação.</p>}

                {photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-1">
                    {photos.map((src, i) => (
                      <button
                        key={src}
                        onClick={() => setLightbox({ photos, index: i })}
                        aria-label={`Ver foto ${i + 1} da avaliação`}
                        className="h-16 w-16 rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[var(--text)]/80 font-semibold mt-2">— {getFirstAndLastName(review.author?.name ?? "") || "Usuário"}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Visualizador de fotos */}
      <ImageLightbox state={lightbox} onChange={setLightbox} label="Fotos da avaliação" />
    </section>
  );
}
