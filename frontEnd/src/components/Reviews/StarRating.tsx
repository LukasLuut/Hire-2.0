import { useState } from "react";
import { Star } from "lucide-react";

/** Estrelas somente leitura (nota média ou nota de uma avaliação). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-yellow-400" aria-label={`${value.toFixed(1)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? "currentColor" : "none"} strokeWidth={1.5} aria-hidden />
      ))}
    </span>
  );
}

/** Seletor de 1 a 5 estrelas, operável por mouse e teclado. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ["Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];
  const shown = hover || value;

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Nota" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"} — ${labels[i - 1]}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="p-1 rounded-md text-yellow-400 transition-transform hover:scale-110"
          >
            <Star size={30} fill={i <= shown ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <span className="text-sm text-[var(--text-muted)] min-w-[6rem]">{shown ? labels[shown - 1] : "Escolha a nota"}</span>
    </div>
  );
}
