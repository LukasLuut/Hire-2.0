import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, X } from "lucide-react";
import { StarInput } from "./StarRating";
import { reviewAPI } from "../../api/ReviewAPI";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";

const MAX_PHOTOS = 5;

/* --------------------------------------------------------------------------
 * ReviewModal — avaliação depois que o serviço é concluído.
 * O cliente avalia o prestador e o prestador avalia o cliente (mútuo),
 * com nota, comentário e até 5 fotos.
 * -------------------------------------------------------------------------- */
interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  hireId: number;
  /** Nome de quem está sendo avaliado */
  targetName: string;
  serviceTitle?: string;
  /** "provider" quando o cliente avalia o prestador; "client" no sentido inverso */
  targetRole: "provider" | "client";
  onDone?: () => void;
}

export default function ReviewModal({ open, onClose, hireId, targetName, serviceTitle, targetRole, onDone }: ReviewModalProps) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setComment("");
    setPhotos([]);
    setPreviews([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    if (images.length > room) showToast(`Você pode enviar até ${MAX_PHOTOS} fotos.`, "warning");
    const accepted = images.slice(0, Math.max(0, room));
    setPhotos((p) => [...p, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!rating) {
      setError("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    setSending(true);
    setError(null);
    try {
      await reviewAPI.create({ hireId, rating, comment, photos }, token);
      showToast("Avaliação enviada. Obrigado!", "success");
      onDone?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível enviar a avaliação. Tente novamente."));
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[var(--bg-light)] rounded-3xl shadow-2xl border border-[var(--border)] p-6 text-[var(--text)]"
          >
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 text-[var(--text)] hover:text-[var(--primary)] transition-colors"
            >
              <X size={22} />
            </button>

            <h2 id="review-title" className="text-2xl font-bold text-[var(--primary)] pr-8">
              Avaliar {targetRole === "provider" ? "prestador" : "cliente"}
            </h2>
            <p className="mt-1 text-[var(--text-muted)]">
              Como foi sua experiência com <strong className="text-[var(--text)]">{targetName}</strong>
              {serviceTitle ? <> em “{serviceTitle}”</> : null}?
            </p>

            <div className="mt-5">
              <StarInput value={rating} onChange={(v) => { setRating(v); setError(null); }} />
            </div>

            <label htmlFor="review-comment" className="mt-5 block text-sm font-semibold">
              Comentário <span className="font-normal text-[var(--text-muted)]">(opcional)</span>
            </label>
            <textarea
              id="review-comment"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={targetRole === "provider" ? "Conte como foi o serviço: pontualidade, qualidade, comunicação…" : "Conte como foi atender este cliente…"}
              className="mt-2 w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-[var(--text)] resize-none focus:border-[var(--primary)] outline-none"
            />

            <div className="mt-4">
              <p className="text-sm font-semibold">
                Fotos <span className="font-normal text-[var(--text-muted)]">(até {MAX_PHOTOS})</span>
              </p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)]">
                    <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Remover foto ${i + 1}`}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
                  >
                    <ImagePlus size={20} />
                    <span className="text-[10px] mt-1">Adicionar</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} disabled={sending} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] transition">
                Agora não
              </button>
              <button
                onClick={submit}
                disabled={sending}
                className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white font-semibold shadow-md hover:scale-[1.02] hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {sending && <Loader2 size={16} className="animate-spin" />}
                Enviar avaliação
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
