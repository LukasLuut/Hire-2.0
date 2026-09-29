/**
 * 09 — COMPARTILHE. O perfil sai da plataforma: o botão Compartilhar do perfil público, o painel
 * real com o link, a imagem que o próprio Hire gera com QR Code, e o perfil aberto no celular de quem escaneou.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, type MotionValue } from "framer-motion";
import { Scene, ActiveBox, Still, Frame, Spotlight, ChapterMark, Reveal, Phone, headlineClass, sceneSize, elevation } from "../primitives";
import { shot, SPOTS, originOf } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade, useKeys } from "../motion";

const HERO = shot("profile-hero");
const PANEL = shot("share-panel");
const CARD = shot("share-card");
const M_PROFILE = shot("m-profile");
const T = COPY.compartilhe;
// as telas cabem na altura livre abaixo do título (sem invadir o título em telas baixas)
const FREE_H = "(100svh - max(36vh, 300px) - 6vh)";
const SCREEN_W = `min(860px, 52vw, calc(${FREE_H} * 1.5))`;
const PHONE_W = `min(250px, 17vw, calc(${FREE_H} * 0.44))`;

export default function S09Compartilhe({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="compartilhe" cinematic={cinematic} labelledBy="compartilhe-title" still={<Still09 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const s = v < 0.3 ? 0 : v < 0.5 ? 1 : v < 0.8 ? 2 : 3;
    setStep((prev) => (prev === s ? prev : s));
  });
  // título e perfil já estão no lugar quando a cena sobe (nada de palco vazio na entrada)
  const hero = useBand(p, [0.3, 0.36], 1, 0);
  const shareSpot = useFade(p, 0.14, 0.18, 0.28, 0.32);
  const panel = useFade(p, 0.3, 0.36, 0.52, 0.58);
  const panelScale = useBand(p, [0.3, 0.38], 0.96, 1);
  // a imagem gerada sai do painel e vem para a frente
  const card = useBand(p, [0.5, 0.58], 0, 1);
  const cardScale = useKeys(p, [0.5, 0.6, 0.7, 0.8, 0.88], [0.62, 1, 1, 1.6, 1]);
  const cardX = useKeys(p, [0.8, 0.9], ["0%", "-16%"]);
  const qrSpot = useFade(p, 0.72, 0.76, 0.82, 0.86);
  const phone = useBand(p, [0.84, 0.92], 0, 1);
  const phoneX = useBand(p, [0.84, 0.93], 80, 0);

  return (
    <div className="absolute inset-0">
      <div className="absolute left-[max(6vw,104px)] top-[12vh] z-10 max-w-[50vw]">
        <ChapterMark id="compartilhe" />
        <h2 id="compartilhe-title" className={`mt-5 ${headlineClass} ${sceneSize}`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </div>
      <ol className="absolute right-[9vw] top-[13vh] z-10 flex gap-5 text-sm">
        {T.steps.map((s, i) => (
          <li key={s} className={`relative isolate transition-colors duration-500 ${i === step ? "text-[var(--text)]" : "text-[var(--text-muted)]/50"}`}>
            {i === step && <ActiveBox group="compartilhe-step" className="-inset-x-2.5 -inset-y-1.5 rounded-lg" />}
            <span className="text-[var(--primary)] tabular-nums mr-1.5">{String(i + 1).padStart(2, "0")}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className="absolute left-[max(6vw,104px)] right-[9vw] top-[max(36vh,300px)] bottom-[6vh] flex items-center justify-center">
        <motion.div className="absolute" style={{ width: SCREEN_W, opacity: hero }}>
          <Frame>
            <Still shot={HERO} alt={ALT.hero} />
            <Spotlight shot={HERO} box={SPOTS.hero.share} opacity={shareSpot} radius={12} />
          </Frame>
        </motion.div>
        <motion.div className="absolute" style={{ width: SCREEN_W, opacity: panel, scale: panelScale }}>
          <Frame>
            <Still shot={PANEL} alt={ALT.share} />
          </Frame>
        </motion.div>
        <motion.div className="absolute w-[min(760px,50vw)]" style={{ opacity: card, scale: cardScale, x: cardX, transformOrigin: originOf(CARD, SPOTS.share.cardQr) }}>
          <div className={`relative rounded-2xl overflow-hidden ring-1 ring-white/12 ${elevation}`}>
            <Still shot={CARD} alt={ALT.card} />
            <Spotlight shot={CARD} box={SPOTS.share.cardQr} opacity={qrSpot} dim={0.45} radius={22} />
          </div>
        </motion.div>
        <motion.div className="absolute right-[2vw]" style={{ width: PHONE_W, opacity: phone, x: phoneX }}>
          <Phone shot={M_PROFILE} alt={ALT.mProfile} />
        </motion.div>
      </div>

    </div>
  );
}

function Still09() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-6xl mx-auto">
      <Reveal>
        <ChapterMark id="compartilhe" />
        <h2 id="compartilhe-title" className={`mt-5 ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </Reveal>
      <div className="mt-12 grid lg:grid-cols-[1.4fr_0.6fr] gap-8 items-center">
        <Reveal><Still shot={CARD} alt={ALT.card} className="rounded-2xl ring-1 ring-white/12" /></Reveal>
        <Reveal delay={0.1} className="flex justify-center"><Phone shot={M_PROFILE} alt={ALT.mProfile} className="w-[min(260px,70vw)]" /></Reveal>
      </div>
    </div>
  );
}
