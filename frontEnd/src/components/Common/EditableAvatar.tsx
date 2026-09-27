import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

/* --------------------------------------------------------------------------
 * EditableAvatar — foto de perfil (pessoal ou profissional).
 * No modo edição, passar o mouse mostra uma câmera com contorno pontilhado
 * em baixa opacidade; clicar (ou Enter/Espaço) abre a escolha da imagem.
 * Fora do modo edição é só a foto.
 * -------------------------------------------------------------------------- */
export default function EditableAvatar({
  src,
  alt,
  editing,
  onPick,
  className = "",
}: {
  src: string;
  alt: string;
  editing: boolean;
  /** recebe a imagem escolhida; a promessa mantém o indicador de envio */
  onPick: (file: File) => Promise<void> | void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      await onPick(file);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  if (!editing) return <img src={src} alt={alt} className={className} />;

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      disabled={busy}
      aria-label="Trocar foto"
      title="Trocar foto"
      className="group relative block w-full h-full rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/50"
    >
      <img src={src} alt={alt} className={className} />
      {/* dica visual no hover: câmera com contorno pontilhado, discreta */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/30 transition-opacity ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
      >
        <span className="flex items-center justify-center w-1/3 aspect-square rounded-full border-2 border-dashed border-white/60 text-white/60">
          {busy ? <Loader2 className="w-1/2 h-1/2 animate-spin" /> : <Camera className="w-1/2 h-1/2" strokeWidth={1.5} />}
        </span>
      </span>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </button>
  );
}
