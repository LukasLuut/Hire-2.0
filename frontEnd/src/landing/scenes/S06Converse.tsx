/**
 * 06 — CONVERSE. O chat real entre Júlia e Tomás, rolando no ritmo da leitura:
 * "Converse" (a necessidade, as perguntas), "Negocie" (o painel com os tópicos acordados entra ao lado),
 * "Combine" (o card de acordo fechado com o contrato gerado).
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Crop, Spotlight, ChapterMark, Reveal, Phone, headlineClass } from "../primitives";
import { shot, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const ROOM = shot("chat-room");
const THREAD = shot("chat-thread");
const PANEL = shot("negotiation-panel");
const M_CHAT = shot("m-chat");
const T = COPY.converse;
// janela de leitura: mostra 1500 px da conversa por vez
const VIEW_H = 1500;
const END = `-${((THREAD.height - VIEW_H) / THREAD.height) * 100}%`;
// o card "Acordo fechado" no fim da conversa (px da tomada alta)
const DEAL = { x: 112, y: THREAD.height - 612, w: 880, h: 168 };

export default function S06Converse({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="converse" length={4} cinematic={cinematic} labelledBy="converse-title" still={<Still06 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [beat, setBeat] = useState(-1);
  useMotionValueEvent(p, "change", (v) => {
    const b = v < 0.06 ? -1 : v < 0.45 ? 0 : v < 0.7 ? 1 : 2;
    setBeat((prev) => (prev === b ? prev : b));
  });
  const enter = useBand(p, [0.02, 0.1], 0, 1);
  const enterY = useBand(p, [0.02, 0.1], 60, 0);
  const tilt = useTransform(p, [0.1, 0.45, 0.68, 0.8], ["0%", "-44%", "-52%", END], { clamp: true });
  const panel = useBand(p, [0.47, 0.56], 0, 1);
  const panelX = useBand(p, [0.47, 0.57], 60, 0);
  const paySpot = useFade(p, 0.56, 0.6, 0.68, 0.72);
  const dealSpot = useFade(p, 0.8, 0.85, 0.98, 1.01);
  const exit = useBand(p, [0.95, 1], 1, 0.4);

  return (
    <motion.div className="absolute inset-0 grid grid-cols-[minmax(300px,0.75fr)_1.5fr] items-center gap-[4vw] pl-[6vw] pr-[9vw] pt-14" style={{ opacity: exit }}>
      <motion.div style={{ opacity: enter }}>
        <ChapterMark id="converse" />
        <h2 id="converse-title" className={`mt-6 ${headlineClass} text-[clamp(2.6rem,5.6vw,6rem)]`}>
          {T.words.map((w, i) => (
            <span key={w} className={`block transition-colors duration-500 ${i === beat ? "text-[var(--text)]" : i < beat ? "text-[var(--text-muted)]" : "text-white/20"}`}>
              {w}
            </span>
          ))}
        </h2>
        <p className="mt-8 max-w-sm text-[var(--text-muted)] min-h-[3.5rem]" aria-live="polite">{beat >= 0 ? T.beats[beat] : ""}</p>
        <p className="mt-6 text-xs tracking-[0.18em] uppercase text-[var(--text-muted)]/70">{T.between}</p>
      </motion.div>

      <motion.div className="flex items-start gap-4 justify-center" style={{ opacity: enter, y: enterY }}>
        {/* a janela da conversa: o cabeçalho real e a conversa rolando por baixo */}
        <div className="w-[min(520px,30vw)] rounded-[22px] overflow-hidden ring-1 ring-white/10 bg-[var(--bg-light)] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)]">
          <Crop shot={ROOM} box={SPOTS.chatRoom.header} alt="Cabeçalho da conversa com Tomás Albuquerque Fotografia" rounded="rounded-none" />
          <div className="relative overflow-hidden" style={{ aspectRatio: `${THREAD.width} / ${VIEW_H}` }}>
            <motion.div className="relative" style={{ y: tilt }}>
              <Still shot={THREAD} alt={ALT.thread} />
              <Spotlight shot={THREAD} box={DEAL} opacity={dealSpot} dim={0.5} radius={20} />
            </motion.div>
          </div>
        </div>
        {/* o painel de negociação entra ao lado, como no app */}
        <motion.div className="w-[min(300px,17vw)] mt-16 rounded-[20px] overflow-hidden ring-1 ring-white/10 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] relative" style={{ opacity: panel, x: panelX }}>
          <Still shot={PANEL} alt={ALT.negotiation} />
          <Spotlight shot={PANEL} box={SPOTS.negotiation.payment} opacity={paySpot} dim={0.45} radius={16} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Still06() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
      <Reveal>
        <ChapterMark id="converse" />
        <h2 id="converse-title" className={`mt-5 ${headlineClass} text-[clamp(2.4rem,9vw,4.5rem)]`}>
          {T.words.map((w) => <span key={w} className="block">{w}</span>)}
        </h2>
        <ul className="mt-8 grid gap-3 text-[var(--text-muted)]">
          {T.beats.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </Reveal>
      <div className="flex justify-center gap-5">
        <Reveal><Phone shot={M_CHAT} alt={ALT.mChat} className="w-[min(290px,74vw)] lg:hidden" /></Reveal>
        <Reveal className="hidden lg:block w-[360px]">
          <Still shot={ROOM} alt={ALT.thread} className="rounded-3xl ring-1 ring-white/10" />
        </Reveal>
        <Reveal delay={0.1} className="hidden lg:block w-[220px] mt-12">
          <Still shot={PANEL} alt={ALT.negotiation} className="rounded-2xl ring-1 ring-white/10" />
        </Reveal>
      </div>
    </div>
  );
}
