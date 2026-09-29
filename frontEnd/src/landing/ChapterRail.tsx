/**
 * Trilho de capítulos (desktop): mostra onde o visitante está na história e permite pular de cena.
 * Discreto: só os números à direita (o atual na cor do Hire); o rótulo aparece ao passar o mouse,
 * para nunca cobrir o conteúdo das cenas.
 */
import { useEffect, useState } from "react";
import { CHAPTERS, type ChapterId } from "./story";

export default function ChapterRail() {
  const [current, setCurrent] = useState<ChapterId | null>(null);
  useEffect(() => {
    // capítulo atual = a seção que cruza a linha do meio da tela (sem medir nada a cada evento de scroll)
    const crossing = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) crossing.add(e.target.id);
          else crossing.delete(e.target.id);
        }
        const found = CHAPTERS.find((c) => crossing.has(c.id))?.id ?? null;
        setCurrent((prev) => (prev === found ? prev : found));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const c of CHAPTERS) {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
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
                <span className={`opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 ${active ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{c.label}</span>
                <span className={`transition-colors duration-300 ${active ? "text-[var(--primary)]" : "text-white/30 group-hover:text-white/60"}`}>{c.number}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
