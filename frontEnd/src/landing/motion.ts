// Movimento da landing: tokens e ganchos. Só transform e opacity (e clip-path pontual) — nada de layout animado.
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Rests } from "./timing";
import { playhead } from "./playback";
import { cubicBezier, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";

/** Entrada que desacelera no fim (a mesma curva do chat do app) */
export const EASE = [0.16, 1, 0.3, 1] as const;

const WIDE = "(min-width: 1024px) and (min-height: 620px)";

/**
 * Coreografia de câmera só no desktop e só para quem não pediu menos movimento —
 * no sistema (prefers-reduced-motion) ou no painel de acessibilidade do próprio Hire.
 * No resto, cada cena mostra uma composição própria, estática e completa.
 */
export function useCinematic() {
  const reduceSystem = useReducedMotion();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  const [reduceApp, setReduceApp] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("a11y-reduce-motion"));
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    const root = document.documentElement;
    const obs = new MutationObserver(() => setReduceApp(root.classList.contains("a11y-reduce-motion")));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);
  return wide && !reduceSystem && !reduceApp;
}

/**
 * Curva de todo movimento da landing: sai devagar, acelera e pousa com calma (nada começa ou para de uma vez).
 * Cada faixa de uma cena usa essa curva; a timeline do play soma a dela por cima.
 */
export const SMOOTH = cubicBezier(0.45, 0, 0.2, 1);

/** Valor que vai de `from` a `to` enquanto o progresso da cena percorre [a, b] (parado fora da faixa) */
export function useBand(p: MotionValue<number>, [a, b]: readonly [number, number], from: number, to: number) {
  return useTransform(p, [a, b], [from, to], { clamp: true, ease: SMOOTH });
}

/** Aparece em [a, b] e some em [c, d] */
export function useFade(p: MotionValue<number>, a: number, b: number, c = 2, d = 3) {
  return useTransform(p, [a, b, c, d], [0, 1, 1, 0], { clamp: true, ease: SMOOTH });
}

/** Keyframes ao longo do progresso, com a mesma curva em cada trecho */
export function useKeys<T extends number | string>(p: MotionValue<number>, stops: number[], values: T[]) {
  return useTransform(p, stops, values, { clamp: true, ease: SMOOTH });
}

/* ------------------------------------------------------------------ ritmo */

// segue o scroll com ~150 ms de suavização, sem passar do ponto (superamortecido: nada de quique)
const SPRING = { stiffness: 220, damping: 36, mass: 0.6, restDelta: 0.0005 };
// o visitante "parou" depois disso sem novos eventos (a inércia do trackpad continua emitindo)
const IDLE_MS = 180;
// quanto a cena pode completar sozinha (em progresso da cena)
const MAX_SETTLE = 0.16;
// parou antes disso da transição: volta ao estado anterior; depois: termina a transição
const COMMIT = 0.35;

/** Para onde a cena assenta se o visitante parar em `v` indo na direção `dir` (null = já está num estado completo) */
function settleTo(v: number, dir: 1 | -1, rests: Rests): number | null {
  let prev: number | null = null;
  let next: number | null = null;
  for (const [a, b] of rests) {
    if (v >= a && v <= b) return null;
    if (b < v) prev = b;
    else if (next === null && a > v) next = a;
  }
  const ahead = dir > 0 ? next : prev;
  const behind = dir > 0 ? prev : next;
  const frac = ahead !== null && behind !== null ? Math.abs(v - behind) / Math.abs(ahead - behind) : 1;
  const first = frac >= COMMIT ? ahead : behind;
  const second = first === ahead ? behind : ahead;
  for (const to of [first, second]) if (to !== null && Math.abs(to - v) <= MAX_SETTLE) return to;
  return null;
}

/**
 * Progresso que as cenas enxergam. O visitante controla a direção; a página controla o ritmo:
 *  - o scroll vira um alvo e a cena o segue por uma mola curta (degraus da roda do mouse viram movimento contínuo);
 *  - se o visitante para no meio de uma transição, a cena termina (ou desfaz) a transição sozinha —
 *    o scroll da página não é tocado, só a coreografia;
 *  - ao voltar a rolar, a diferença entre cena e scroll se desfaz aos poucos, sempre no sentido do gesto
 *    (nada anda para trás nem fica parado esperando o scroll alcançar).
 */
export function useNarrativeProgress(raw: MotionValue<number>, rests: Rests, ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const target = useMotionValue(raw.get());
  const p = useSpring(target, SPRING);
  const s = useRef({ last: raw.get(), dir: 1 as 1 | -1, off: 0, anchor: 0, near: false, timer: 0 });
  // onde a seção está no documento (para ler o progresso direto do play, sem medir a cada quadro)
  const geo = useRef({ top: 0, span: 1 });

  // só a cena perto da tela reage; as outras acompanham o scroll sem mola nem assentamento.
  // Ao chegar perto (inclusive por link de capítulo, que não mexe no progresso dela), tenta assentar.
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const st = s.current;
    const measure = () => {
      geo.current = { top: el.getBoundingClientRect().top + window.scrollY, span: Math.max(1, el.offsetHeight - window.innerHeight) };
    };
    measure();
    window.addEventListener("resize", measure);
    const io = new IntersectionObserver(([e]) => {
      measure();
      st.near = e.isIntersecting;
      window.clearTimeout(st.timer);
      if (st.near) st.timer = window.setTimeout(() => settleRef.current(), IDLE_MS);
    }, { rootMargin: "50% 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", measure);
      window.clearTimeout(st.timer);
    };
  }, [enabled, ref]);

  // durante o play: o progresso sai da posição exata do play, no mesmo quadro, sem mola (a timeline já tem a
  // aceleração certa); a mola fica para o scroll feito à mão
  useMotionValueEvent(playhead, "change", (y) => {
    const st = s.current;
    if (y < 0 || !enabled || !st.near) return;
    const v = Math.min(1, Math.max(0, (y - geo.current.top) / geo.current.span));
    window.clearTimeout(st.timer);
    st.off = 0;
    st.dir = 1;
    target.set(v);
    p.jump(v);
  });

  /** alvo = scroll + a diferença deixada pelo último assentamento, que some depois de rolar 2× essa distância */
  const compose = (v: number) => {
    const st = s.current;
    if (st.off === 0) return v;
    const k = 1 - Math.abs(v - st.anchor) / (2 * Math.abs(st.off));
    if (k <= 0) {
      st.off = 0;
      return v;
    }
    return Math.min(1, Math.max(0, v + st.off * k));
  };

  const settle = () => {
    const st = s.current;
    const el = ref.current;
    if (!el) return;
    // só com o palco preso na tela (inclui a chegada por link de capítulo, no topo da seção)
    const r = el.getBoundingClientRect();
    if (r.top > 1 || r.bottom < window.innerHeight - 1) return;
    const v = raw.get();
    const to = settleTo(compose(v), st.dir, rests);
    if (to === null) return;
    st.off = to - v;
    st.anchor = v;
    target.set(to);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useMotionValueEvent(raw, "change", (v) => {
    const st = s.current;
    if (Math.abs(v - st.last) > 1e-4) st.dir = v > st.last ? 1 : -1;
    st.last = v;
    // o play já conduz esta cena (o evento de scroll chega depois, arredondado)
    if (playhead.get() >= 0 && st.near) return;
    window.clearTimeout(st.timer);
    if (!enabled || !st.near) {
      st.off = 0;
      target.set(v);
      p.jump(v);
      return;
    }
    target.set(compose(v));
    st.timer = window.setTimeout(() => settleRef.current(), IDLE_MS);
  });

  return p;
}
