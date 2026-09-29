/**
 * 04 — CONHEÇA. O perfil público real do Tomás, lido como uma página: push-in lento na identidade,
 * a câmera desce para o "Conheça Tomás" (tempo de leitura), depois o portfólio; o visualizador do app
 * abre a foto da Camila e do Rafael, avança para a saída dos noivos, e essa cresce até virar o cenário
 * da próxima cena (a foto da estrada já abriu a história na cena 01).
 */
import { useState } from "react";
import { motion, useMotionValueEvent, type MotionValue } from "framer-motion";
import { Scene, ActiveBox, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS, originOf } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade, useKeys } from "../motion";
import { photoLayer } from "../photoLayer";

const HERO = shot("profile-hero");
const ABOUT = shot("profile-about");
const PORTFOLIO = shot("profile-portfolio");
const LIGHTBOX_A = shot("portfolio-lightbox-embrace");
const LIGHTBOX_B = shot("portfolio-lightbox-sparklers");
const M_PROFILE = shot("m-profile");
const M_PORTFOLIO = shot("m-portfolio");
const T = COPY.conheca;

// "Conheça" e o portfólio foram recortados com 1320 px de largura da página de 1440 px:
// na coluna, ficam com a mesma escala do topo do perfil
const INNER = { width: `${(1320 / 1440) * 100}%`, marginLeft: `${(60 / 1440) * 100}%` };

export default function S04Conheca({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="conheca" cinematic={cinematic} labelledBy="conheca-title" still={<Still04 />}>
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
  // título e tela já estão no lugar quando a cena sobe (nada de palco vazio na entrada)
  // sai depois da última pausa (a saída dos noivos aberta), junto com a foto crescendo
  const titleOpacity = useBand(p, [0.92, 0.96], 1, 0);
  const frameOpacity = useBand(p, [0.95, 0.99], 1, 0);
  // push-in na identidade (termina exatamente na pausa) e volta junto com a descida
  const pushIn = useKeys(p, [0.1, 0.3, 0.4], [1, 1.22, 1]);
  // a câmera desce a página: topo → Conheça → portfólio (em % da própria coluna); parada em cada pausa
  const tilt = useKeys(p, [0.3, 0.42, 0.62, 0.72], ["0%", "-35.5%", "-35.5%", "-59%"]);
  const photoSpot = useFade(p, 0.73, 0.76, 0.8, 0.82);
  // o visualizador abre a foto destacada e avança para a próxima (como a seta do app)
  const lightbox = useFade(p, 0.8, 0.85);
  const lightboxScale = useBand(p, [0.8, 0.86], 0.94, 1);
  const nextPhoto = useBand(p, [0.87, 0.91], 0, 1);
  const nextX = useBand(p, [0.87, 0.91], 40, 0);
  // a foto aberta cresce até a tela cheia — é a camada compartilhada com a cena 05 (sharedPhoto.tsx)
  const photo = useBand(p, [0.92, 0.99], 0, 1);
  const photoScale = useBand(p, [0.92, 0.99], 0.72, 1);
  const photoDim = useBand(p, [0.95, 0.99], 0, 0.55);
  useMotionValueEvent(photo, "change", (v) => photoLayer.opacity.set(v));
  useMotionValueEvent(photoScale, "change", (v) => photoLayer.scale.set(v));
  useMotionValueEvent(photoDim, "change", (v) => photoLayer.dim.set(v));

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute left-[max(6vw,104px)] top-[14vh] max-w-[29vw] z-10" style={{ opacity: titleOpacity }}>
        <ChapterMark id="conheca" />
        <h2 id="conheca-title" className={`mt-5 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </motion.div>

      {/* legenda do momento: quem é / como trabalha / o que já fez */}
      <motion.div className="absolute left-[max(6vw,104px)] bottom-[9vh] z-10 flex gap-6 text-sm" style={{ opacity: titleOpacity }} aria-hidden>
        {T.beats.map((b, i) => (
          <span key={b} className={`relative isolate transition-colors duration-500 ${i === beat ? "text-[var(--text)]" : "text-[var(--text-muted)]/50"}`}>
            {i === beat && <ActiveBox group="conheca-beat" className="-inset-x-2.5 -inset-y-1.5 rounded-lg" />}
            <span className={`inline-block w-6 h-px align-middle mr-2 transition-colors duration-500 ${i === beat ? "bg-[var(--primary)]" : "bg-white/20"}`} />
            {b}
          </span>
        ))}
      </motion.div>

      <motion.div className="absolute right-[8vw] top-1/2 -translate-y-[42%] w-[min(980px,50vw)]" style={{ opacity: frameOpacity }}>
        <Frame className="aspect-[1440/900]">
          <motion.div style={{ y: tilt }}>
            <motion.div style={{ scale: pushIn, transformOrigin: originOf(HERO, SPOTS.hero.identity) }}>
              <Still shot={HERO} alt={ALT.hero} />
            </motion.div>
            <div style={INNER}>
              <Still shot={ABOUT} alt={ALT.about} />
              <div className="relative">
                <Still shot={PORTFOLIO} alt={ALT.portfolio} />
                <Spotlight shot={PORTFOLIO} box={SPOTS.portfolio.second} opacity={photoSpot} radius={14} />
              </div>
            </div>
          </motion.div>
          {/* o visualizador de fotos do próprio app */}
          <motion.div className="absolute inset-0" style={{ opacity: lightbox, scale: lightboxScale }}>
            <Still shot={LIGHTBOX_A} alt={ALT.lightboxEmbrace} />
            <motion.div className="absolute inset-0" style={{ opacity: nextPhoto, x: nextX }}>
              <Still shot={LIGHTBOX_B} alt={ALT.lightboxSparklers} />
            </motion.div>
          </motion.div>
        </Frame>
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
