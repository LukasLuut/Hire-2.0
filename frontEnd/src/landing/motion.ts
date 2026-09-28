// Movimento da landing: tokens e ganchos. Só transform e opacity (e clip-path pontual) — nada de layout animado.
import { useEffect, useState } from "react";
import { useReducedMotion, useTransform, type MotionValue } from "framer-motion";

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

/** Valor que vai de `from` a `to` enquanto o progresso da cena percorre [a, b] (parado fora da faixa) */
export function useBand(p: MotionValue<number>, [a, b]: readonly [number, number], from: number, to: number) {
  return useTransform(p, [a, b], [from, to], { clamp: true });
}

/** Aparece em [a, b] e some em [c, d] */
export function useFade(p: MotionValue<number>, a: number, b: number, c = 2, d = 3) {
  return useTransform(p, [a, b, c, d], [0, 1, 1, 0], { clamp: true });
}
