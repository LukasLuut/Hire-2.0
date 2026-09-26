import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, QrCode, Share2, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { LOCAL_PORT } from "../../api/ApiClient";
import { track } from "../../utils/analytics";
import { canNativeShare, copyLink, nativeShare, trackWhatsapp, whatsappHref, type ShareTarget } from "../../utils/share";
import { useToast } from "../Toast/ToastContext";

/* --------------------------------------------------------------------------
 * SharePanel — "Compartilhar" com os canais disponíveis:
 * folha nativa (celular), copiar link, WhatsApp e, para perfis, QR Code
 * (gerado pelo servidor, com download em PNG para imprimir).
 * -------------------------------------------------------------------------- */
export default function SharePanel({
  open,
  onClose,
  target,
  qrFor,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget;
  /** id ou slug do prestador: mostra o QR Code do perfil */
  qrFor?: string | number;
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
            className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] p-5 text-[var(--text)]"
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

            {qrFor && (
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
