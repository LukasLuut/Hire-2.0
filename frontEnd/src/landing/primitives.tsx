// Peças comuns das cenas: palco pinado, tomada real, recorte, destaque, títulos e botões.
import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useScroll, type MotionStyle, type MotionValue } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { pct, type Box, type Shot } from "./media";
import { CHAPTERS, type ChapterId } from "./story";
import { EASE } from "./motion";

/* ------------------------------------------------------------------ cena */

/**
 * Cena da landing. No modo cinematográfico, a seção tem `length` telas de altura e o palco fica
 * preso (sticky) enquanto o progresso do scroll (0 → 1) conduz a câmera. Fora dele (celular,
 * movimento reduzido), a cena é a composição estática `still`, com a mesma informação.
 */
export function Scene({
  id,
  length,
  cinematic,
  children,
  still,
  className = "",
  labelledBy,
}: {
  id: ChapterId;
  length: number;
  cinematic: boolean;
  children: (p: MotionValue<number>) => ReactNode;
  still: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  if (!cinematic) {
    return (
      // a ref fica na seção mesmo sem coreografia: o useScroll exige o alvo montado
      <section ref={ref} id={id} aria-labelledby={labelledBy} className={`relative scroll-mt-16 ${className}`}>
        {still}
      </section>
    );
  }
  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} className={`relative ${className}`} style={{ height: `${length * 100}vh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">{children(scrollYProgress)}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ tomadas */

/** Tomada real do app. Reserva o espaço pela proporção (sem CLS) e carrega sob demanda. */
export function Still({ shot, alt, className = "", style, priority = false }: { shot: Shot; alt: string; className?: string; style?: CSSProperties; priority?: boolean }) {
  return (
    <img
      src={shot.src}
      width={shot.width}
      height={shot.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={`block w-full h-auto select-none ${className}`}
      style={style}
    />
  );
}

/** Moldura de janela: as tomadas do app aparecem como a tela do produto, não como imagem solta */
export function Frame({ children, className = "", style }: { children: ReactNode; className?: string; style?: MotionStyle }) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-[18px] bg-[var(--bg)] ring-1 ring-white/10 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.02)] ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/** Um pedaço de uma tomada (px da imagem), ocupando a largura disponível */
export function Crop({ shot, box, alt, className = "", style, rounded = "rounded-2xl" }: { shot: Shot; box: Box; alt: string; className?: string; style?: MotionStyle; rounded?: string }) {
  return (
    <motion.div
      role="img"
      aria-label={alt}
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ aspectRatio: `${box.w} / ${box.h}`, ...style }}
    >
      <img
        src={shot.src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ width: `${(shot.width / box.w) * 100}%`, left: `${(-box.x / box.w) * 100}%`, top: `${(-box.y / box.h) * 100}%` }}
      />
    </motion.div>
  );
}

/** Destaque sobre uma tomada: contorno na cor do Hire e o resto da tela escurecido */
export function Spotlight({ shot, box, opacity, dim = 0.62, radius = 18 }: { shot: Shot; box: Box; opacity: MotionValue<number> | number; dim?: number; radius?: number }) {
  return (
    <motion.div
      aria-hidden
      className="absolute pointer-events-none ring-2 ring-[var(--primary)]"
      style={{ ...pct(shot, box), opacity, borderRadius: radius, boxShadow: `0 0 0 200vmax rgba(0,0,0,${dim})` }}
    />
  );
}

/* ------------------------------------------------------------------ texto */

/** "01 — Encontre": onde o visitante está na história */
export function ChapterMark({ id, className = "", style }: { id: ChapterId; className?: string; style?: MotionStyle }) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return (
    <motion.p className={`text-[12px] md:text-[13px] font-medium tracking-[0.22em] uppercase text-[var(--text-muted)] tabular-nums ${className}`} style={style}>
      <span className="text-[var(--primary)]">{c.number}</span>
      <span className="mx-2 opacity-50">—</span>
      {c.label}
    </motion.p>
  );
}

/** Título de cena: tamanho de manchete, linhas quebradas pelo roteiro */
export const headlineClass = "font-semibold tracking-[-0.035em] leading-[1.02] text-balance text-[var(--text)]";
export const displaySize = "text-[clamp(2.6rem,6.6vw,7.25rem)]";
export const sceneSize = "text-[clamp(2.1rem,4.4vw,4.75rem)]";

/** Entrada simples ao aparecer (composições estáticas); some sozinha com movimento reduzido */
export function Reveal({ children, delay = 0, className = "", y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ ações */

export function PrimaryCta({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 h-13 px-7 rounded-full bg-[var(--primary)] text-white text-[15px] font-semibold transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      {children}
      <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function GhostCta({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center h-13 px-7 rounded-full text-[15px] font-medium text-[var(--text)] ring-1 ring-white/20 transition-colors duration-200 hover:ring-white/45 hover:bg-white/[0.03] ${className}`}
    >
      {children}
    </Link>
  );
}

/** Tela de celular para as tomadas mobile (proporção do aparelho, sem enfeite) */
export function Phone({ shot, alt, className = "", style }: { shot: Shot; alt: string; className?: string; style?: MotionStyle }) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-[34px] bg-black ring-1 ring-white/15 p-[7px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] ${className}`}
      style={style}
    >
      <div className="overflow-hidden rounded-[28px]">
        <Still shot={shot} alt={alt} />
      </div>
    </motion.div>
  );
}
