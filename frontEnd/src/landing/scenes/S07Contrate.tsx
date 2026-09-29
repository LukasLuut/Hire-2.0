/**
 * 07 — CONTRATE. O payoff: a jornada inteira numa travessia rápida (pan horizontal, uma montagem) —
 * busca, perfil, portfólio, conversa, negociação e contrato — sempre com a Júlia e o Tomás.
 * No fim o contrato dá lugar ao que importa nele: as duas assinaturas, de perto.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Crop, ChapterMark, Reveal, headlineClass, sceneSize, lift } from "../primitives";
import { shot, SPOTS, type Shot } from "../media";
import { COPY, ALT } from "../story";
import { useBand } from "../motion";

const T = COPY.contrate;
// a travessia ocupa [0, 0.62] do progresso, com aceleração no início e desaceleração no fim
const PAN_END = 0.62;
const travel = (v: number) => {
  const t = Math.min(1, Math.max(0, v / PAN_END));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const CONTRACT = shot("contract-signed");
const STEPS: { shot: Shot; alt: string }[] = [
  { shot: shot("search-results"), alt: ALT.results },
  { shot: shot("profile-hero"), alt: ALT.hero },
  { shot: shot("portfolio-lightbox-embrace"), alt: ALT.lightboxEmbrace },
  { shot: shot("chat-room"), alt: ALT.thread },
  { shot: shot("negotiation-panel"), alt: ALT.negotiation },
  { shot: CONTRACT, alt: ALT.contract },
];

export default function S07Contrate({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="contrate" cinematic={cinematic} labelledBy="contrate-title" still={<Still07 />}>
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
  // a travessia começa com a cena no lugar e acelera/desacelera (nada de movimento retilíneo)
  const x = useTransform([p, dist], ([v, d]: number[]) => -d * travel(v));
  const [active, setActive] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = Math.round(travel(v) * 5);
    setActive((prev) => (prev === i ? prev : i));
  });
  // o título já está na tela quando a cena sobe
  // começa a sair só depois da pausa do fim da travessia (nada congela no meio)
  const title = useBand(p, [0.62, 0.68], 1, 0);
  const others = useBand(p, [0.62, 0.7], 1, 0);
  // o contrato dá lugar ao que importa nele: as duas assinaturas
  const contract = useBand(p, [0.66, 0.72], 1, 0);
  const sealed = useBand(p, [0.68, 0.78], 0, 1);
  const sealedScale = useBand(p, [0.66, 0.8], 0.86, 1);
  const payoff = useBand(p, [0.78, 0.84], 0, 1);
  const payoffY = useBand(p, [0.78, 0.86], 20, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-x-0 top-[11vh] text-center px-6 z-10" style={{ opacity: title }}>
        <ChapterMark id="contrate" />
        <h2 id="contrate-title" className={`mt-5 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </motion.div>

      <motion.div ref={track} className="absolute left-[8vw] top-[40vh] flex items-start gap-[5vh] will-change-transform" style={{ x }}>
        {STEPS.map((s, i) => {
          const isLast = i === STEPS.length - 1;
          return (
            <motion.div key={s.shot.name} ref={isLast ? last : undefined} className="shrink-0" style={{ opacity: isLast ? contract : others }}>
              <div
                className={`relative h-[46vh] overflow-hidden rounded-[16px] ring-1 ring-white/10 bg-[var(--bg)] ${lift}`}
                style={{ aspectRatio: `${s.shot.width} / ${s.shot.height}` }}
              >
                <img src={s.shot.src} alt={s.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
              <motion.p className={`mt-4 text-sm tabular-nums transition-colors duration-500 ${i === active ? "text-[var(--text)]" : "text-[var(--text-muted)]/60"}`} style={{ opacity: others }}>
                <span className="text-[var(--primary)]">{String(i + 1).padStart(2, "0")}</span> &nbsp;{T.steps[i]}
              </motion.p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* o payoff: as assinaturas da Júlia e do Tomás, de perto */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-6">
        <motion.div className="w-[min(1000px,64vw)]" style={{ opacity: sealed, scale: sealedScale }}>
          <Crop shot={CONTRACT} box={SPOTS.contract.sealed} alt={ALT.contract} rounded="rounded-[18px]" className={`ring-1 ring-white/10 ${lift}`} />
        </motion.div>
        <motion.p className="text-center text-lg md:text-xl text-[var(--text)]" style={{ opacity: payoff, y: payoffY }}>
          {T.payoff}
        </motion.p>
      </div>
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
