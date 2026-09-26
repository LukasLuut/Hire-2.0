import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";

/** Campo do painel de filtros (mesmo visual em todas as buscas) */
export const filterField =
  "w-full p-2.5 rounded-xl bg-[var(--bg-dark)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--primary)]";

/** Botão liga/desliga do painel (disponibilidade etc.) */
export function FilterToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`px-3 py-1.5 rounded-full border transition ${on ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}
    >
      {label}
    </button>
  );
}

/**
 * Barra de busca com ícone de filtros no fim: o ícone abre um painel logo abaixo
 * (Esc ou clique fora fecha). O conteúdo do painel vem em `children`.
 */
export default function SearchWithFilters({
  value,
  onChange,
  placeholder,
  activeCount,
  resultCount,
  onClear,
  showFilters = true,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  activeCount: number;
  resultCount: number;
  onClear: () => void;
  showFilters?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center gap-3 h-[52px] pl-4 pr-2 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)] focus-within:border-[var(--primary)] transition"
        role="search"
      >
        <Search className="shrink-0 text-[var(--text-muted)]" size={20} aria-hidden />
        <input
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-muted)] flex-1 min-w-0"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label="Limpar busca" className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        )}
        {showFilters && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={activeCount ? `Filtros (${activeCount} ativos)` : "Filtros"}
            className={`relative shrink-0 flex items-center gap-2 h-9 px-3 rounded-xl border transition ${open || activeCount ? "border-[var(--primary)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
          >
            <SlidersHorizontal size={18} aria-hidden />
            <span className="hidden sm:inline text-sm">Filtros</span>
            {activeCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">{activeCount}</span>
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showFilters && open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-2 p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-xl grid gap-4 sm:grid-cols-2 text-left"
          >
            {children}
            <div className="sm:col-span-2 flex justify-between items-center pt-3 border-t border-[var(--border)]">
              <button type="button" onClick={onClear} disabled={!activeCount} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40">
                Limpar filtros
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium">
                Ver {resultCount} resultado{resultCount === 1 ? "" : "s"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
