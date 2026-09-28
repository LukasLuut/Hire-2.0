/**
 * 07 — CONTRATE. O payoff: a jornada inteira numa travessia contínua (pan horizontal) —
 * busca, perfil, portfólio, conversa, negociação e contrato — sempre com a Júlia e o Tomás.
 * No fim a câmera se aproxima das duas assinaturas.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Spotlight, ChapterMark, Reveal, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS, originOf, type Shot } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const T = COPY.contrate;
const CONTRACT = shot("contract-signed");
const STEPS: { shot: Shot; alt: string }[] = [
  { shot: shot("search-results"), alt: ALT.results },
  { shot: shot("profile-hero"), alt: ALT.hero },
  { shot: shot("portfolio-lightbox"), alt: ALT.lightbox },
  { shot: shot("chat-room"), alt: ALT.thread },
  { shot: shot("negotiation-panel"), alt: ALT.negotiation },
  { shot: CONTRACT, alt: ALT.contract },
];

export default function S07Contrate({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="contrate" length={4.4} cinematic={cinematic} labelledBy="contrate-title" still={<Still07 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const track = useRef<HTMLDivElement>(null);
  const last = useRef<HTMLDivElement>(null);
  // distância do pan: do primeiro quadro até o contrato centralizado na tela
  const dist = useMotionValue(0);
  useEffect(() => {
    const measure = () => {
      if (!track.current || !last.current) return;
      const center = last.current.offsetLeft + last.current.offsetWidth / 2;
      dist.set(Math.max(0, center - window.innerWidth / 2 + track.current.offsetLeft));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dist]);
  const x = useTransform([p, dist], ([v, d]: number[]) => -d * Math.min(1, Math.max(0, (v - 0.12) / 0.62)));
  const [active, setActive] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = Math.max(0, Math.min(5, Math.round(((v - 0.12) / 0.62) * 5)));
    setActive((prev) => (prev === i ? prev : i));
  });
  const title = useFade(p, 0, 0.07, 0.8, 0.86);
  const zoom = useBand(p, [0.78, 0.9], 1, 1.5);
  // sobe junto do zoom para as assinaturas ficarem no centro e a frase final caber embaixo
  const trackY = useTransform(p, [0.78, 0.9], ["0vh", "-16vh"], { clamp: true });
  const others = useBand(p, [0.76, 0.84], 1, 0);
  const sigSpot = useFade(p, 0.88, 0.92);
  const payoff = useBand(p, [0.9, 0.96], 0, 1);
  const payoffY = useBand(p, [0.9, 0.97], 20, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-x-0 top-[11vh] text-center px-6 z-10" style={{ opacity: title }}>
        <ChapterMark id="contrate" />
        <h2 id="contrate-title" className={`mt-5 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </motion.div>

      <motion.div ref={track} className="absolute left-[8vw] top-[40vh] flex items-start gap-[5vh] will-change-transform" style={{ x, y: trackY }}>
        {STEPS.map((s, i) => {
          const isLast = i === STEPS.length - 1;
          return (
            <motion.div key={s.shot.name} ref={isLast ? last : undefined} className="shrink-0" style={{ opacity: isLast ? 1 : others }}>
              <motion.div
                className="relative h-[46vh] overflow-hidden rounded-[16px] ring-1 ring-white/10 bg-[var(--bg)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]"
                style={{ aspectRatio: `${s.shot.width} / ${s.shot.height}`, ...(isLast ? { scale: zoom, transformOrigin: originOf(CONTRACT, SPOTS.contract.signatures) } : {}) }}
              >
                <img src={s.shot.src} alt={s.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                {isLast && <Spotlight shot={CONTRACT} box={SPOTS.contract.signatures} opacity={sigSpot} dim={0.55} radius={12} />}
              </motion.div>
              <motion.p className={`mt-4 text-sm tabular-nums transition-colors duration-500 ${i === active ? "text-[var(--text)]" : "text-[var(--text-muted)]/60"}`} style={{ opacity: others }}>
                <span className="text-[var(--primary)]">{String(i + 1).padStart(2, "0")}</span> &nbsp;{T.steps[i]}
              </motion.p>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.p className="absolute inset-x-0 bottom-[8vh] text-center px-6 text-lg md:text-xl text-[var(--text)]" style={{ opacity: payoff, y: payoffY }}>
        {T.payoff}
      </motion.p>
    </div>
  );
}

function Still07() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-6xl mx-auto">
      <Reveal className="text-center">
        <ChapterMark id="contrate" />
        <h2 id="contrate-title" className={`mt-5 ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </Reveal>
      <ol className="mt-12 grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {STEPS.map((s, i) => (
          <li key={s.shot.name}>
            <Reveal delay={0.05 * i}>
              <div className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/10 bg-[var(--bg)]">
                <img src={s.shot.src} alt={s.alt} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
              </div>
              <p className="mt-3 text-sm"><span className="text-[var(--primary)] tabular-nums">{String(i + 1).padStart(2, "0")}</span> &nbsp;{T.steps[i]}</p>
            </Reveal>
          </li>
        ))}
      </ol>
      <Reveal className="mt-12 text-center">
        <p className="text-lg text-[var(--text)]">{T.payoff}</p>
      </Reveal>
    </div>
  );
}
