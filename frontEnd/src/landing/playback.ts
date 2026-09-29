// Reprodução por cenas: rolar para baixo é o "play" da cena atual; rolar para cima é navegação normal.
// As cenas continuam lendo o progresso do scroll (nada da coreografia muda) — o que muda é quem move o scroll:
// no ↓, a página leva o scroll pela timeline da cena (transições com aceleração suave, pausa de leitura em cada
// estado completo, ver timing.ts) até o fim dela, e para ali esperando o próximo gesto.
import { useEffect } from "react";
import { animate, cancelFrame, frame, motionValue, useMotionValue, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { CHAPTERS, type ChapterId } from "./story";
import { SCENES } from "./timing";

/**
 * Posição exata do play (px do documento, fracionária); -1 fora do play. As cenas leem daqui durante a
 * reprodução — no mesmo quadro e sem arredondar — em vez de esperar o evento de scroll (que chega um quadro
 * depois e em px inteiros, o que fazia o movimento tremer). O scroll da página só acompanha.
 */
export const playhead = motionValue(-1);

// ritmo geral: multiplica todas as durações da timeline (1 = como em timing.ts)
const PACE = 0.85;
// eventos separados por menos que isso são o mesmo gesto (roda girando, inércia do trackpad, um swipe)
const GESTURE_GAP_MS = 220;
// a cena seguinte subindo para a tela (1 tela de scroll)
const ENTRANCE_S = 1.1;
// transições: base + por tela de scroll, dentro de um mínimo e um máximo
const TRANSITION = { base: 0.45, perScreen: 1.15, min: 0.6, max: 2 };
// dentro de um estado completo sem `move` definido: segundos por tela de scroll
const REST_PER_SCREEN = 1.2;
// o sinal "role para continuar" aparece depois de a cena parar por esse tempo
const HINT_DELAY_MS = 900;

const DOWN_KEYS = new Set(["ArrowDown", "PageDown", " "]);
const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home", "End"]);

const inOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
const linear = (t: number) => t;

/** Um trecho da timeline: o scroll vai de `from` a `to` (px) em `dur` segundos */
type Segment = { from: number; to: number; dur: number; ease: (t: number) => number };
type Track = { id: ChapterId; end: number; segments: Segment[] };

/** A timeline de cada cena, em px do documento: entrada, transições e estados completos com pausa */
function tracks(): Track[] {
  const out: Track[] = [];
  const vh = window.innerHeight;
  let prev = 0;
  for (const c of CHAPTERS) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    const span = el.offsetHeight - vh;
    const end = top + span;
    const at = (p: number) => top + p * span;
    const screens = (dp: number) => (dp * span) / vh;
    const segments: Segment[] = [];
    if (prev < top) segments.push({ from: prev, to: top, dur: ENTRANCE_S, ease: inOut });
    let p = 0;
    for (const [a, b, hold = 0, move, arrive] of SCENES[c.id].rests) {
      if (a > p) {
        const dur = arrive ?? Math.min(TRANSITION.max, Math.max(TRANSITION.min, TRANSITION.base + screens(a - p) * TRANSITION.perScreen));
        segments.push({ from: at(p), to: at(a), dur, ease: inOut });
      }
      if (b > a) segments.push({ from: at(a), to: at(b), dur: move ?? screens(b - a) * REST_PER_SCREEN, ease: linear });
      if (hold > 0 && b < 1) segments.push({ from: at(b), to: at(b), dur: hold, ease: linear });
      p = Math.max(p, b);
    }
    if (p < 1) segments.push({ from: at(p), to: end, dur: TRANSITION.min, ease: inOut });
    const pace = PACE * (SCENES[c.id].pace ?? 1);
    for (const s of segments) s.dur *= pace;
    out.push({ id: c.id, end, segments });
    prev = end;
  }
  return out;
}

/** Posição do scroll no tempo `t` (s) da timeline e o instante da timeline que corresponde a `y` */
function sample(segments: Segment[], t: number) {
  for (const s of segments) {
    if (t <= s.dur) return s.from + (s.to - s.from) * s.ease(s.dur > 0 ? t / s.dur : 1);
    t -= s.dur;
  }
  return segments[segments.length - 1].to;
}
function timeAt(segments: Segment[], y: number) {
  let t = 0;
  for (const s of segments) {
    if (s.to <= y + 1) {
      t += s.dur; // já passou deste trecho (e das pausas nele): retoma depois
      continue;
    }
    if (s.from >= y) return t;
    // no meio de um trecho: acha o instante pela curva (a curva é monotônica)
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (s.from + (s.to - s.from) * s.ease(mid) < y) lo = mid;
      else hi = mid;
    }
    return t + hi * s.dur;
  }
  return t;
}
const total = (segments: Segment[]) => segments.reduce((n, s) => n + s.dur, 0);

/**
 * Relógio do play: roda no frameloop do Framer (o render sai no mesmo quadro), mas mede o tempo pelo início
 * do quadro (document.timeline), que é alinhado à tela. performance.now() varia ~1 ms de um quadro para o
 * outro conforme o JS roda — o suficiente para o movimento tremer em cenas rápidas.
 */
function run(duration: number, onUpdate: (elapsed: number) => void, onComplete: () => void) {
  let start: number | null = null;
  const tick = () => {
    const now = (document.timeline.currentTime as number | null) ?? performance.now();
    if (start === null) start = now;
    const elapsed = Math.min(duration, (now - start) / 1000);
    onUpdate(elapsed);
    if (elapsed >= duration) {
      cancelFrame(tick);
      onComplete();
    }
  };
  frame.update(tick, true);
  return { stop: () => cancelFrame(tick) };
}

function isTyping(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));
}

/**
 * Máquina de estados (tudo em variáveis locais — nenhum setState por evento):
 *   IDLE ──↓ novo gesto──▶ PLAYING ──fim da cena──▶ IDLE
 *   PLAYING ──↑ / link / barra de rolagem──▶ IDLE (para onde estiver; ↑ segue nativo)
 * Durante o PLAYING, o ↓ é consumido (não reinicia nem enfileira). Depois do fim, o resto do mesmo gesto
 * (inércia) também é consumido: uma ação → uma cena.
 * Devolve `hint` (0 → 1): o sinal de que a história continua, visível só com a cena parada no fim.
 */
export function useScenePlayback(enabled: boolean): MotionValue<number> {
  const hint = useMotionValue(0);
  useEffect(() => {
    if (!enabled) return;
    let playing: { stop: () => void } | null = null;
    let hintAnim: AnimationPlaybackControls | null = null;
    let hintTimer = 0;
    let restY: number | null = null;
    let lastSet = 0;
    let lastInput = 0;
    let gestureUsed = false; // o gesto atual já tocou uma cena (ou começou durante uma)

    const setHint = (v: 0 | 1) => {
      window.clearTimeout(hintTimer);
      if (hint.get() === v) return;
      hintAnim?.stop();
      hintAnim = animate(hint, v, { duration: v ? 0.6 : 0.2 });
    };
    const stop = () => {
      playing?.stop();
      playing = null;
      playhead.set(-1);
    };

    /** Toca o que falta da cena em que o visitante está. false = não há cena à frente (rodapé): scroll nativo. */
    const play = () => {
      const y = window.scrollY;
      const all = tracks();
      const i = all.findIndex((s) => s.end > y + 4);
      if (i < 0) return false;
      const { segments } = all[i];
      const from = timeAt(segments, y);
      const dur = total(segments) - from;
      const last = i === all.length - 1;
      setHint(0);
      restY = null;
      lastSet = y;
      playing = run(
        dur,
        (elapsed) => {
          // alguém mexeu no scroll por fora (link de capítulo, barra de rolagem): a reprodução cede
          if (Math.abs(window.scrollY - lastSet) > 3) return stop();
          const exact = sample(segments, from + elapsed);
          playhead.set(exact);
          lastSet = Math.round(exact);
          window.scrollTo(0, lastSet);
        },
        () => {
          playing = null;
          playhead.set(-1);
          if (last) return;
          restY = window.scrollY;
          hintTimer = window.setTimeout(() => setHint(1), HINT_DELAY_MS);
        },
      );
      return true;
    };

    /** Intenção de avanço. Devolve true se o evento deve ser consumido. */
    const forward = (newGesture: boolean) => {
      if (playing) {
        gestureUsed = true;
        return true;
      }
      if (!newGesture && gestureUsed) return true; // resto do gesto que já tocou uma cena
      if (!play()) return false;
      gestureUsed = true;
      return true;
    };
    const back = () => {
      stop();
      gestureUsed = false;
      setHint(0);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
      const now = performance.now();
      const newGesture = now - lastInput > GESTURE_GAP_MS;
      lastInput = now;
      if (newGesture && !playing) gestureUsed = false;
      if (e.deltaY < 0) return back();
      if (forward(newGesture)) e.preventDefault();
    };

    // toque (tablet em paisagem, que também tem a coreografia): um swipe é um gesto
    let touchY: number | null = null;
    let touchDir = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      touchDir = 0;
      if (!playing) gestureUsed = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - (e.touches[0]?.clientY ?? touchY);
      if (touchDir === 0) {
        if (dy === 0) return;
        touchDir = dy > 0 ? 1 : -1;
        if (touchDir < 0) return back();
        if (forward(true) && e.cancelable) e.preventDefault();
        else touchDir = 2; // nada à frente: gesto nativo
        return;
      }
      if (touchDir === 1 && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (UP_KEYS.has(e.key) || (e.key === " " && e.shiftKey)) return back();
      if (!DOWN_KEYS.has(e.key)) return;
      if (forward(!e.repeat)) e.preventDefault();
    };

    // o sinal some assim que a página sai do ponto em que a cena parou (qualquer que seja o meio)
    const onScroll = () => {
      if (restY !== null && Math.abs(window.scrollY - restY) > 8) {
        restY = null;
        setHint(0);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stop();
      hintAnim?.stop();
      window.clearTimeout(hintTimer);
      hint.set(0);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled, hint]);
  return hint;
}
