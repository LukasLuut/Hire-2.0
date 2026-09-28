/**
 * 04 — CONHEÇA. O perfil público real do Tomás, lido como uma página: push-in lento na identidade,
 * a câmera desce para o "Conheça Tomás" (tempo de leitura), depois o portfólio; uma foto abre no
 * visualizador do app e cresce até virar o cenário da próxima cena.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize } from "../primitives";
import { shot, photoSrcSet, SPOTS, originOf } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const HERO = shot("profile-hero");
const ABOUT = shot("profile-about");
const PORTFOLIO = shot("profile-portfolio");
const LIGHTBOX = shot("portfolio-lightbox");
const PHOTO = shot("photo-field-walk");
const M_PROFILE = shot("m-profile");
const M_PORTFOLIO = shot("m-portfolio");
const T = COPY.conheca;

// "Conheça" e o portfólio foram recortados com 1320 px de largura da página de 1440 px:
// na coluna, ficam com a mesma escala do topo do perfil
const INNER = { width: `${(1320 / 1440) * 100}%`, marginLeft: `${(60 / 1440) * 100}%` };

export default function S04Conheca({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="conheca" length={4} cinematic={cinematic} labelledBy="conheca-title" still={<Still04 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const b = v < 0.32 ? 0 : v < 0.64 ? 1 : 2;
    setBeat((prev) => (prev === b ? prev : b));
  });
  const titleOpacity = useFade(p, 0, 0.06, 0.86, 0.9);
  const frameOpacity = useFade(p, 0.02, 0.09, 0.9, 0.95);
  const frameY = useBand(p, [0.02, 0.1], 80, 0);
  // push-in na identidade e volta
  const pushIn = useTransform(p, [0.08, 0.28, 0.36], [1, 1.28, 1], { clamp: true });
  // a câmera desce a página: topo → Conheça → portfólio (em % da própria coluna)
  const tilt = useTransform(p, [0.3, 0.42, 0.62, 0.72, 0.8], ["0%", "-34.5%", "-36.5%", "-58.5%", "-59.5%"], { clamp: true });
  const firstSpot = useFade(p, 0.73, 0.76, 0.8, 0.82);
  const lightbox = useFade(p, 0.8, 0.85);
  const lightboxScale = useBand(p, [0.8, 0.86], 0.94, 1);
  const photo = useBand(p, [0.88, 0.96], 0, 1);
  const photoScale = useBand(p, [0.88, 1], 0.72, 1);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute left-[6vw] top-[14vh] max-w-[34vw] z-10" style={{ opacity: titleOpacity }}>
        <ChapterMark id="conheca" />
        <h2 id="conheca-title" className={`mt-5 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </motion.div>

      {/* legenda do momento: quem é / como trabalha / o que já fez */}
      <motion.div className="absolute left-[6vw] bottom-[9vh] z-10 flex gap-6 text-sm" style={{ opacity: titleOpacity }} aria-hidden>
        {T.beats.map((b, i) => (
          <span key={b} className={`transition-colors duration-500 ${i === beat ? "text-[var(--text)]" : "text-[var(--text-muted)]/50"}`}>
            <span className={`inline-block w-6 h-px align-middle mr-2 transition-colors duration-500 ${i === beat ? "bg-[var(--primary)]" : "bg-white/20"}`} />
            {b}
          </span>
        ))}
      </motion.div>

      <motion.div className="absolute right-[9vw] top-1/2 -translate-y-[42%] w-[min(1040px,54vw)]" style={{ opacity: frameOpacity, y: frameY }}>
        <Frame className="aspect-[1440/900]">
          <motion.div style={{ y: tilt }}>
            <motion.div style={{ scale: pushIn, transformOrigin: originOf(HERO, SPOTS.hero.identity) }}>
              <Still shot={HERO} alt={ALT.hero} />
            </motion.div>
            <div style={INNER}>
              <Still shot={ABOUT} alt={ALT.about} />
              <div className="relative">
                <Still shot={PORTFOLIO} alt={ALT.portfolio} />
                <Spotlight shot={PORTFOLIO} box={SPOTS.portfolio.first} opacity={firstSpot} radius={14} />
              </div>
            </div>
          </motion.div>
          {/* o visualizador de fotos do próprio app */}
          <motion.div className="absolute inset-0" style={{ opacity: lightbox, scale: lightboxScale }}>
            <Still shot={LIGHTBOX} alt={ALT.lightbox} />
          </motion.div>
        </Frame>
      </motion.div>

      {/* a foto cresce até virar o cenário da cena seguinte */}
      <motion.div className="absolute inset-0" style={{ opacity: photo }} aria-hidden>
        <motion.img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ scale: photoScale }} />
        <div className="absolute inset-0 bg-black/55" />
      </motion.div>
    </div>
  );
}

function Still04() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-6xl mx-auto">
      <Reveal>
        <ChapterMark id="conheca" />
        <h2 id="conheca-title" className={`mt-5 max-w-3xl ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </Reveal>
      <div className="mt-12 flex justify-center gap-5 lg:hidden">
        <Reveal><Phone shot={M_PROFILE} alt={ALT.mProfile} className="w-[min(280px,70vw)]" /></Reveal>
        <Reveal delay={0.1} className="hidden sm:block"><Phone shot={M_PORTFOLIO} alt={ALT.mPortfolio} className="w-[280px]" /></Reveal>
      </div>
      <div className="mt-12 hidden lg:grid gap-8">
        <Reveal><Frame><Still shot={HERO} alt={ALT.hero} /></Frame></Reveal>
        <Reveal><Frame><Still shot={ABOUT} alt={ALT.about} /></Frame></Reveal>
        <Reveal><Frame><Still shot={PORTFOLIO} alt={ALT.portfolio} /></Frame></Reveal>
      </div>
    </div>
  );
}
