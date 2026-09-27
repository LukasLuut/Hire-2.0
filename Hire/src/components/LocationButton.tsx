import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LocateFixed } from "lucide-react";
import LocationBar from "./LocationBar";
import type { ClientLocation } from "../utils/location";

/**
 * Localização da busca num círculo: o ícone abre um painel em cascata com as opções
 * (usar a localização do aparelho, CEP, "só quem atende minha região").
 * Com localização escolhida, o círculo fica azul.
 */
export default function LocationButton(props: {
  location: ClientLocation | null;
  onChange: (loc: ClientLocation | null) => void;
  onlyNearby: boolean;
  onOnlyNearbyChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!props.location;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={active ? `Localização: ${props.location!.label}` : "Veja quem atende perto de você"}
        title={active ? `Perto de ${props.location!.label}` : "Veja quem atende perto de você"}
        className={`w-[68px] h-[68px] rounded-full border flex items-center justify-center transition
          ${active ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-[var(--bg-light)]/30 border-[var(--border-muted)] text-[var(--text)] hover:border-[var(--primary)]"}`}
      >
        <LocateFixed size={24} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-2 w-[min(92vw,420px)] rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-xl"
          >
            <LocationBar
              {...props}
              onChange={(loc) => { props.onChange(loc); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
