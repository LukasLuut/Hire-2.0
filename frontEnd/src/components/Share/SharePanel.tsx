import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, ImageDown, Loader2, Moon, QrCode, Share2, Sun, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { LOCAL_PORT } from "../../api/ApiClient";
import { track } from "../../utils/analytics";
import { canNativeShare, copyLink, nativeShare, trackWhatsapp, whatsappHref, type ShareTarget } from "../../utils/share";
import { useToast } from "../Toast/ToastContext";
import { renderProfileCard, type CardTheme, type ProfileCardData } from "./profileCard";

/* --------------------------------------------------------------------------
 * SharePanel — "Compartilhar" com os canais disponíveis:
 * folha nativa (celular), copiar link, WhatsApp e, para perfis, a imagem do perfil
 * (recorte do hero com o QR Code ao lado), com tema próprio e download em PNG.
 * -------------------------------------------------------------------------- */
export default function SharePanel({
  open,
  onClose,
  target,
  qrFor,
  card,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget;
  /** id ou slug do prestador: mostra o QR Code do perfil */
  qrFor?: string | number;
  /** dados do perfil: mostra a imagem de compartilhamento no lugar do QR Code sozinho */
  card?: ProfileCardData;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setQrError(false);
    closeRef.current?.focus();
    if (qrFor) track("qr_open", { providerId: target.providerId });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    if (await copyLink(target)) {
      setCopied(true);
      showToast("Link copiado. É só colar onde quiser.", "success");
      setTimeout(() => setCopied(false), 2500);
    } else {
      showToast("Não foi possível copiar. Selecione o endereço e copie manualmente.", "warning");
    }
  };

  const qrSrc = qrFor ? `${LOCAL_PORT}/providers/${qrFor}/qr` : "";
  const btn = "w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition text-left";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${card ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] p-5 text-[var(--text)]`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="share-title" className="text-lg font-semibold">Compartilhar</h2>
              <button ref={closeRef} onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-[var(--bg)]"><X size={20} /></button>
            </div>

            <p className="text-sm text-[var(--text-muted)] mb-2 line-clamp-2">{target.title}</p>
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs">
              <span className="flex-1 truncate" title={target.url}>{target.url}</span>
            </div>

            <div className="flex flex-col gap-2">
              {canNativeShare() && (
                <button className={btn} onClick={async () => { if (await nativeShare(target)) onClose(); }}>
                  <Share2 size={18} className="text-[var(--primary)]" /> Compartilhar pelo celular
                </button>
              )}
              <button className={btn} onClick={copy} aria-live="polite">
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-[var(--primary)]" />}
                {copied ? "Link copiado!" : "Copiar link"}
              </button>
              <a className={btn} href={whatsappHref(target)} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsapp(target)}>
                <FaWhatsapp size={18} className="text-green-500" /> Enviar pelo WhatsApp
              </a>
            </div>

            {card && <ProfileCardShare card={card} />}

            {qrFor && !card && (
              <div className="mt-5 pt-4 border-t border-[var(--border)] text-center">
                <h3 className="font-medium flex items-center justify-center gap-2 mb-3"><QrCode size={18} className="text-[var(--primary)]" /> QR Code do perfil</h3>
                {qrError ? (
                  <p className="text-sm text-[var(--text-muted)]">Não foi possível gerar o QR Code agora.</p>
                ) : (
                  <img
                    src={qrSrc}
                    alt="QR Code que abre o perfil público"
                    width={192}
                    height={192}
                    onError={() => setQrError(true)}
                    className="mx-auto rounded-lg bg-white p-2 w-48 h-48"
                  />
                )}
                <p className="text-xs text-[var(--text-muted)] mt-2">Imprima em cartões, adesivos ou no seu local de trabalho. Quem apontar a câmera abre seu perfil.</p>
                {!qrError && (
                  <a href={`${qrSrc}?download=1`} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium">
                    <Download size={16} /> Baixar QR Code (PNG)
                  </a>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Imagem do perfil para divulgar: prévia, tema só da imagem, baixar e compartilhar o arquivo */
function ProfileCardShare({ card }: { card: ProfileCardData }) {
  const { showToast } = useToast();
  const pageTheme: CardTheme = document.body.classList.contains("light") ? "light" : "dark";
  const [theme, setTheme] = useState<CardTheme>(pageTheme);
  const [image, setImage] = useState<{ url: string; blob: Blob; theme: CardTheme } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    renderProfileCard(card, theme)
      .then((blob) => {
        if (!alive) return;
        setImage((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: URL.createObjectURL(blob), blob, theme };
        });
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [card, theme]);

  const fileName = `hire-${card.slug}-${theme === "dark" ? "escuro" : "claro"}.png`;
  const file = image ? new File([image.blob], fileName, { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const loading = !image || image.theme !== theme;

  return (
    <div className="mt-5 pt-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-medium flex items-center gap-2">
          <QrCode size={18} className="text-[var(--primary)]" /> Imagem do perfil
        </h3>
        {/* tema só da imagem: não muda o tema do site */}
        <div role="radiogroup" aria-label="Tema da imagem" className="flex p-1 rounded-full bg-[var(--bg)] border border-[var(--border)]">
          {([["dark", "Escuro", Moon], ["light", "Claro", Sun]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${theme === value ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg)] min-h-40">
        {error ? (
          <p className="p-6 text-sm text-center text-[var(--text-muted)]">Não foi possível montar a imagem agora. Tente de novo em instantes.</p>
        ) : (
          <>
            {image && <img src={image.url} alt={`Imagem do perfil de ${card.name} com QR Code`} className={`block w-full h-auto transition-opacity duration-200 ${loading ? "opacity-40" : "opacity-100"}`} />}
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]" aria-live="polite">
                <Loader2 className="animate-spin" size={22} aria-label="Gerando imagem" />
              </span>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">Use em redes sociais, cartões ou no seu local de trabalho. Quem apontar a câmera para o QR Code abre seu perfil.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={image?.url}
          download={fileName}
          aria-disabled={loading}
          onClick={(e) => loading && e.preventDefault()}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium ${loading ? "opacity-50 pointer-events-none" : "hover:brightness-110"}`}
        >
          <ImageDown size={16} /> Baixar imagem (PNG)
        </a>
        {canShareFile && (
          <button
            type="button"
            onClick={() => navigator.share({ files: [file!], title: card.name }).catch(() => showToast("Compartilhamento cancelado.", "info"))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:border-[var(--primary)]"
          >
            <Share2 size={16} /> Enviar imagem
          </button>
        )}
        <a href={`${LOCAL_PORT}/providers/${card.qrFor}/qr?download=1`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:border-[var(--primary)]">
          <Download size={16} /> Só o QR Code
        </a>
      </div>
    </div>
  );
}
