/**
 * 03 — DESCUBRA. A busca real, passo a passo: palavra, filtros, localização, resultados e quem faz.
 * O roteiro fica à esquerda (onde estamos); à direita, a mesma tela do app ganha foco em cada parte.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const RESULTS = shot("search-results");
const FILTERS = shot("search-filters");
const M_SEARCH = shot("m-search");
const T = COPY.descubra;
// faixas de progresso de cada passo do roteiro
const STEPS: [number, number][] = [
  [0.1, 0.26],
  [0.26, 0.42],
  [0.42, 0.56],
  [0.56, 0.74],
  [0.74, 1.01],
];

export default function S03Descubra({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="descubra" length={3.6} cinematic={cinematic} labelledBy="descubra-title" still={<Still03 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [step, setStep] = useState(-1);
  useMotionValueEvent(p, "change", (v) => {
    const i = STEPS.findIndex(([a, b]) => v >= a && v < b);
    setStep((prev) => (prev === i ? prev : i));
  });
  const titleOpacity = useBand(p, [0.0, 0.07], 0, 1);
  const line2 = useBand(p, [0.05, 0.12], 0.25, 1);
  const stage = useBand(p, [0.03, 0.12], 0, 1);
  const stageX = useBand(p, [0.03, 0.12], 60, 0);

  const barSpot = useFade(p, 0.12, 0.15, 0.23, 0.26);
  const filtersReveal = useTransform(p, [0.27, 0.32, 0.4, 0.43], [100, 0, 0, 100], { clamp: true });
  const filtersClip = useTransform(filtersReveal, (v) => `inset(0% 0% ${v}% 0%)`);
  const locSpot = useFade(p, 0.44, 0.47, 0.53, 0.56);
  const gridSpot = useFade(p, 0.58, 0.62, 0.7, 0.74);
  const recSpot = useFade(p, 0.76, 0.8, 0.96, 1.01);
  const camScale = useTransform(p, [0.56, 0.72, 0.8], [1, 1.05, 1.08], { clamp: true });
  const camX = useTransform(p, [0.74, 0.84], ["0%", "-4%"], { clamp: true });

  return (
    <div className="absolute inset-0 grid grid-cols-[minmax(320px,0.8fr)_1.4fr] items-center gap-[4vw] pl-[6vw] pr-[9vw] pt-16">
      <motion.div style={{ opacity: titleOpacity }}>
        <ChapterMark id="descubra" />
        <h2 id="descubra-title" className={`mt-6 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <motion.span className="block text-[var(--text-muted)]" style={{ opacity: line2 }}>{T.headline[1]}</motion.span>
        </h2>
        <ol className="mt-10 grid gap-4 max-w-sm">
          {T.steps.map((s, i) => (
            <li key={s.label} className={`relative pl-5 transition-opacity duration-500 ${i === step ? "opacity-100" : "opacity-35"}`}>
              <span className={`absolute left-0 top-1 bottom-1 w-[2px] rounded-full transition-colors duration-500 ${i === step ? "bg-[var(--primary)]" : "bg-white/15"}`} aria-hidden />
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-sm text-[var(--text-muted)] mt-0.5">{s.text}</span>
            </li>
          ))}
        </ol>
      </motion.div>

      <motion.div style={{ opacity: stage, x: stageX }}>
        <Frame style={{ scale: camScale, x: camX, transformOrigin: "70% 60%" }}>
          <Still shot={RESULTS} alt={ALT.results} />
          <motion.div className="absolute inset-x-0 top-0" style={{ clipPath: filtersClip }}>
            <Still shot={FILTERS} alt={ALT.filters} />
          </motion.div>
          <Spotlight shot={RESULTS} box={SPOTS.results.bar} opacity={barSpot} radius={40} />
          <Spotlight shot={RESULTS} box={SPOTS.results.location} opacity={locSpot} radius={40} />
          <Spotlight shot={RESULTS} box={SPOTS.results.grid} opacity={gridSpot} />
          <Spotlight shot={RESULTS} box={SPOTS.results.recommended} opacity={recSpot} radius={22} />
        </Frame>
      </motion.div>
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
