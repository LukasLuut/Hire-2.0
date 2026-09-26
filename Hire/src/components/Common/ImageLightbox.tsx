import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/* --------------------------------------------------------------------------
 * ImageLightbox — visualizador de fotos em tela cheia (avaliações, portfólio).
 * Fecha no fundo, no X ou com Esc; setas do teclado trocam de foto.
 * -------------------------------------------------------------------------- */
export interface LightboxState {
  photos: string[];
  index: number;
  /** legenda opcional por foto (ex.: título do item do portfólio) */
  captions?: (string | undefined)[];
}

export default function ImageLightbox({
  state,
  onChange,
  label = "Fotos",
}: {
  state: LightboxState | null;
  onChange: (next: LightboxState | null) => void;
  label?: string;
}) {
  const count = state?.photos.length ?? 0;
  const go = (delta: number) => state && onChange({ ...state, index: (state.index + delta + count) % count });

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      if (e.key === "ArrowLeft" && count > 1) go(-1);
      if (e.key === "ArrowRight" && count > 1) go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const caption = state?.captions?.[state.index];
  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onChange(null)}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <button onClick={() => onChange(null)} aria-label="Fechar" className="absolute top-5 right-5 text-white/80 hover:text-white">
            <X size={28} />
          </button>
          {count > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="Foto anterior"
              className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft size={26} />
            </button>
          )}
          <motion.img
            key={state.index}
            src={state.photos[state.index]}
            alt={caption || `Foto ${state.index + 1} de ${count}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
          />
          {caption && <p className="mt-3 text-white/90 text-sm text-center max-w-xl" onClick={(e) => e.stopPropagation()}>{caption}</p>}
          {count > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="Próxima foto"
              className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronRight size={26} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
