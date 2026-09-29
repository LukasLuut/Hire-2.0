/**
 * 03 — DESCUBRA. A busca real, passo a passo: palavra, filtros, localização, resultados e quem faz.
 * O roteiro fica à esquerda (o passo atual num quadro na cor do Hire); à direita, a tela real inteira,
 * com a parte de que o passo fala em destaque.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, ActiveBox, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS, type Box } from "../media";
import { COPY, ALT } from "../story";
import { useFade, useKeys } from "../motion";

const RESULTS = shot("search-results");
const FILTERS = shot("search-filters");
const LOCATION = shot("search-location");
const M_SEARCH = shot("m-search");
const T = COPY.descubra;
// faixas de progresso de cada passo do roteiro (as mesmas de timing.ts)
const STEPS: [number, number][] = [
  [0, 0.21],
  [0.21, 0.37],
  [0.37, 0.57],
  [0.57, 0.76],
  [0.76, 1.01],
];

/**
 * Enquadramento de uma parte da tela: o maior zoom (até `max`) em que a parte inteira cabe na janela,
 * centralizada sem deixar borda vazia. A parte nunca fica cortada. Valores em % da própria tomada.
 */
function fit(b: Box, max: number) {
  const z = Math.min(max, 0.9 / Math.max(b.w / RESULTS.width, b.h / RESULTS.height));
  const room = ((z - 1) / 2) * 100;
  const clamp = (v: number) => Math.max(-room, Math.min(room, v));
  return {
    z,
    x: `${clamp(-((b.x + b.w / 2) / RESULTS.width - 0.5) * z * 100)}%`,
    y: `${clamp(-((b.y + b.h / 2) / RESULTS.height - 0.5) * z * 100)}%`,
  };
}
const WIDE = { z: 1, x: "0%", y: "0%" };
const MENU = fit(SPOTS.results.locationMenu, 1.8);
const GRID = fit(SPOTS.results.grid, 1.35);
const PROS = fit(SPOTS.results.recommended, 1.6);
// busca e filtros: tela inteira · localização: zoom no menu e de volta · resultados: zoom e de volta ·
// quem faz: zoom (cada passo sai da tela inteira e volta a ela antes do próximo)
const KEYS = [0, 0.38, 0.46, 0.5, 0.56, 0.58, 0.64, 0.72, 0.76, 0.8, 1];
const FRAMES = [WIDE, WIDE, MENU, MENU, WIDE, WIDE, GRID, GRID, WIDE, PROS, PROS];

export default function S03Descubra({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="descubra" cinematic={cinematic} labelledBy="descubra-title" still={<Still03 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = Math.max(0, STEPS.findIndex(([a, b]) => v >= a && v < b));
    setStep((prev) => (prev === i ? prev : i));
  });
  const camScale = useKeys(p, KEYS, FRAMES.map((f) => f.z));
  const camX = useKeys(p, KEYS, FRAMES.map((f) => f.x));
  const camY = useKeys(p, KEYS, FRAMES.map((f) => f.y));

  const barSpot = useFade(p, 0.08, 0.12, 0.2, 0.23);
  const filtersReveal = useKeys(p, [0.22, 0.27, 0.33, 0.37], [100, 0, 0, 100]);
  const filtersClip = useTransform(filtersReveal, (v) => `inset(0% 0% ${v}% 0%)`);
  // o menu de localização abre (a tomada real com ele aberto) antes do zoom e fecha depois de voltar
  const location = useFade(p, 0.37, 0.4, 0.54, 0.57);
  const locSpot = useFade(p, 0.43, 0.46, 0.5, 0.53);
  const gridSpot = useFade(p, 0.6, 0.64, 0.72, 0.75);
  const recSpot = useFade(p, 0.77, 0.8);

  return (
    <div className="absolute inset-0 grid grid-cols-[minmax(320px,0.8fr)_1.4fr] items-center gap-[4vw] pl-[max(6vw,104px)] pr-[9vw] pt-16">
      <div>
        <ChapterMark id="descubra" />
        <h2 id="descubra-title" className={`mt-6 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
        <ol className="mt-10 grid gap-4 max-w-sm">
          {T.steps.map((s, i) => (
            <li key={s.label} className={`relative isolate transition-opacity duration-500 ${i === step ? "opacity-100" : "opacity-40"}`}>
              {i === step && <ActiveBox group="descubra-step" />}
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-sm text-[var(--text-muted)] mt-0.5">{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* a janela fica parada; a câmera entra nela só onde o passo pede, sem cortar a parte mostrada */}
      <Frame>
        <motion.div style={{ scale: camScale, x: camX, y: camY }}>
          <Still shot={RESULTS} alt={ALT.results} />
          <motion.div className="absolute inset-x-0 top-0" style={{ clipPath: filtersClip }}>
            <Still shot={FILTERS} alt={ALT.filters} />
          </motion.div>
          <motion.div className="absolute inset-0" style={{ opacity: location }}>
            <Still shot={LOCATION} alt={ALT.location} />
          </motion.div>
          <Spotlight shot={RESULTS} box={SPOTS.results.bar} opacity={barSpot} radius={40} />
          <Spotlight shot={RESULTS} box={SPOTS.results.locationMenu} opacity={locSpot} radius={18} />
          <Spotlight shot={RESULTS} box={SPOTS.results.grid} opacity={gridSpot} />
          <Spotlight shot={RESULTS} box={SPOTS.results.recommended} opacity={recSpot} radius={22} />
        </motion.div>
      </Frame>
    </div>
  );
}

function Still03() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
      <Reveal>
        <ChapterMark id="descubra" />
        <h2 id="descubra-title" className={`mt-5 ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
        <ol className="mt-8 grid gap-4">
          {T.steps.map((s) => (
            <li key={s.label} className="pl-4 border-l-2 border-[var(--primary)]/60">
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-sm text-[var(--text-muted)]">{s.text}</span>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal delay={0.15} className="flex justify-center">
        <Phone shot={M_SEARCH} alt={ALT.mSearch} className="w-[min(300px,78vw)] lg:hidden" />
        <Frame className="hidden lg:block">
          <Still shot={RESULTS} alt={ALT.results} />
        </Frame>
      </Reveal>
    </div>
  );
}
