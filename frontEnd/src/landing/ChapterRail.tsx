/**
 * Trilho de capítulos (desktop): mostra onde o visitante está na história e permite pular de cena.
 * Discreto: números à direita, o rótulo só do capítulo atual.
 */
import { useEffect, useState } from "react";
import { CHAPTERS, type ChapterId } from "./story";

export default function ChapterRail() {
  const [current, setCurrent] = useState<ChapterId | null>(null);
  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight * 0.5;
      let found: ChapterId | null = null;
      for (const c of CHAPTERS) {
        const el = document.getElementById(c.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) found = c.id;
      }
      setCurrent((prev) => (prev === found ? prev : found));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav aria-label="Capítulos da apresentação" className={`fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:block transition-opacity duration-500 ${current ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <ol className="flex flex-col items-end gap-2.5">
        {CHAPTERS.map((c) => {
          const active = c.id === current;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={active ? "step" : undefined}
                className="group flex items-center gap-3 text-[11px] tabular-nums tracking-[0.14em] uppercase"
              >
                <span className={`transition-opacity duration-300 ${active ? "opacity-100 text-[var(--text)]" : "opacity-0 group-hover:opacity-70 text-[var(--text-muted)]"}`}>{c.label}</span>
                <span className={`transition-colors duration-300 ${active ? "text-[var(--primary)]" : "text-white/30 group-hover:text-white/60"}`}>{c.number}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
