/**
 * 08 — MOSTRE SEU TRABALHO. A câmera vira: até aqui, quem procura; agora, quem oferece.
 * O painel real do Tomás — perfil completo, o pedido novo do Rodrigo (o mesmo cliente das bodas)
 * e o portfólio organizado como vitrine.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const BUSINESS = shot("business");
const REQUEST = shot("business-request");
const B_PORTFOLIO = shot("business-portfolio");
const M_PORTFOLIO = shot("m-portfolio");
const T = COPY.mostre;

export default function S08Mostre({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="mostre" length={3.6} cinematic={cinematic} labelledBy="mostre-title" still={<Still08 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [note, setNote] = useState(-1);
  useMotionValueEvent(p, "change", (v) => {
    const n = v < 0.14 ? -1 : v < 0.4 ? 0 : v < 0.64 ? 1 : 2;
    setNote((prev) => (prev === n ? prev : n));
  });
  // a luz muda: um azul muito escuro marca o outro lado da história
  const tint = useFade(p, 0, 0.12, 0.9, 1);
  const enter = useBand(p, [0.02, 0.1], 0, 1);
  const eyebrow = useFade(p, 0.0, 0.05, 0.9, 1);
  const frameX = useBand(p, [0.02, 0.12], 80, 0);
  const completeSpot = useFade(p, 0.16, 0.2, 0.36, 0.4);
  const request = useFade(p, 0.42, 0.48, 0.62, 0.66);
  const requestY = useBand(p, [0.42, 0.5], 60, 0);
  const dash = useTransform(p, [0.42, 0.48, 0.64, 0.7], [1, 0.35, 0.35, 0.2], { clamp: true });
  const portfolio = useBand(p, [0.66, 0.74], 0, 1);
  const portfolioY = useBand(p, [0.66, 0.76], 40, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_60%)]" style={{ opacity: tint }} aria-hidden />
      <div className="absolute inset-0 grid grid-cols-[minmax(300px,0.72fr)_1.5fr] items-center gap-[4vw] pl-[6vw] pr-[9vw] pt-14">
        <motion.div style={{ opacity: enter }}>
          <motion.p className="text-sm text-[var(--primary)] mb-4" style={{ opacity: eyebrow }}>{T.eyebrow}</motion.p>
          <ChapterMark id="mostre" />
          <h2 id="mostre-title" className={`mt-6 ${headlineClass} ${sceneSize}`}>{T.headline}</h2>
          <ol className="mt-10 grid gap-5 max-w-sm">
            {T.notes.map((n, i) => (
              <li key={n.title} className={`transition-opacity duration-500 ${i === note ? "opacity-100" : "opacity-35"}`}>
                <span className="block font-semibold">{n.title}</span>
                <span className="block text-sm text-[var(--text-muted)] mt-1">{n.text}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div className="relative" style={{ opacity: enter, x: frameX }}>
          <Frame style={{ opacity: dash }}>
            <Still shot={BUSINESS} alt={ALT.business} />
            <Spotlight shot={BUSINESS} box={SPOTS.business.complete} opacity={completeSpot} radius={20} />
          </Frame>
          {/* o pedido do Rodrigo vem para a frente */}
          <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%]" style={{ opacity: request, y: requestY }}>
            <Still shot={REQUEST} alt={ALT.request} className="rounded-2xl shadow-[0_40px_90px_-20px_rgba(0,0,0,0.95)]" />
          </motion.div>
          {/* o portfólio como vitrine */}
          <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96%]" style={{ opacity: portfolio, y: portfolioY }}>
            <Still shot={B_PORTFOLIO} alt={ALT.businessPortfolio} className="rounded-[20px] shadow-[0_50px_120px_-30px_rgba(0,0,0,0.95)]" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function Still08() {
  return (
    <div className="relative py-24 md:py-32 px-5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_30%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_60%)]" aria-hidden />
      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
        <Reveal>
          <p className="text-sm text-[var(--primary)] mb-3">{T.eyebrow}</p>
          <ChapterMark id="mostre" />
          <h2 id="mostre-title" className={`mt-5 ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>{T.headline}</h2>
          <ul className="mt-8 grid gap-4">
            {T.notes.map((n) => (
              <li key={n.title}>
                <span className="block font-semibold">{n.title}</span>
                <span className="block text-sm text-[var(--text-muted)]">{n.text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="grid gap-5 justify-items-center">
          <Reveal className="lg:hidden"><Phone shot={M_PORTFOLIO} alt={ALT.mPortfolio} className="w-[min(290px,74vw)]" /></Reveal>
          <Reveal className="hidden lg:block"><Frame><Still shot={BUSINESS} alt={ALT.business} /></Frame></Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm"><Still shot={REQUEST} alt={ALT.request} className="rounded-2xl" /></Reveal>
        </div>
      </div>
    </div>
  );
}
