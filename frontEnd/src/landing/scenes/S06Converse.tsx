/**
 * 06 — CONVERSE. O chat real entre Júlia e Tomás, rolando no ritmo da leitura:
 * "Converse" (a necessidade, as perguntas), "Negocie" (o painel com os tópicos acordados entra ao lado),
 * "Combine" (o card de acordo fechado com o contrato gerado).
 */
import { useState } from "react";
import { motion, useMotionValueEvent, type MotionValue } from "framer-motion";
import { Scene, Still, Crop, Spotlight, ChapterMark, Reveal, Phone, headlineClass, elevation, lift } from "../primitives";
import { shot, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade, useKeys } from "../motion";

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
// a janela do chat cabe na altura da tela (cabeçalho + trecho da conversa = 1,48 × a largura)
const CHAT_RATIO = 130 / 1120 + VIEW_H / THREAD.width;
const CHAT_W = `min(560px, 31vw, calc((100svh - 120px) / ${CHAT_RATIO.toFixed(3)}))`;
// o painel de negociação tem exatamente a altura da janela do chat: topo e base alinhados
const PANEL_W = `calc(${CHAT_W} * ${(CHAT_RATIO / (PANEL.height / PANEL.width)).toFixed(3)})`;

export default function S06Converse({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="converse" cinematic={cinematic} labelledBy="converse-title" still={<Still06 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const b = v < 0.45 ? 0 : v < 0.7 ? 1 : 2;
    setBeat((prev) => (prev === b ? prev : b));
  });
  // a conversa rola até a pausa, espera o painel entrar e segue até o acordo (parada exata nas pausas)
  const tilt = useKeys(p, [0.1, 0.47, 0.57, 0.8], ["0%", "-44%", "-44%", END]);
  const panel = useBand(p, [0.47, 0.56], 0, 1);
  const panelX = useBand(p, [0.47, 0.57], 60, 0);
  const paySpot = useFade(p, 0.56, 0.6, 0.68, 0.72);
  const dealSpot = useFade(p, 0.8, 0.85, 0.98, 1.01);

  return (
    <div className="absolute inset-0 grid grid-cols-[minmax(240px,1fr)_auto] items-center gap-[4vw] pl-[max(6vw,104px)] pr-[8vw]">
      <div>
        <ChapterMark id="converse" />
        <h2 id="converse-title" className={`mt-6 ${headlineClass} text-[clamp(2.4rem,min(5.2vw,9vh),5.75rem)]`}>
          {T.words.map((w, i) => (
            // o tópico do momento em branco pleno; os que já passaram, médios; os que vêm, bem apagados
            <span key={w} className={`block transition-colors duration-700 ${i === beat ? "text-white" : i < beat ? "text-white/40" : "text-white/15"}`}>
              {w}
            </span>
          ))}
        </h2>
        <p className="mt-8 max-w-sm text-[var(--text)]/85 min-h-[3.5rem]" aria-live="polite">{T.beats[beat]}</p>
        <p className="mt-6 text-xs tracking-[0.18em] uppercase text-[var(--text-muted)]/70">{T.between}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* a janela da conversa: o cabeçalho real e a conversa rolando por baixo */}
        <div style={{ width: CHAT_W }} className={`rounded-[22px] overflow-hidden ring-1 ring-white/10 bg-[var(--bg-light)] ${elevation}`}>
          <Crop shot={ROOM} box={SPOTS.chatRoom.header} alt="Cabeçalho da conversa com Tomás Albuquerque Fotografia" rounded="rounded-none" />
          <div className="relative overflow-hidden" style={{ aspectRatio: `${THREAD.width} / ${VIEW_H}` }}>
            <motion.div className="relative" style={{ y: tilt }}>
              <Still shot={THREAD} alt={ALT.thread} />
              <Spotlight shot={THREAD} box={DEAL} opacity={dealSpot} dim={0.5} radius={20} />
            </motion.div>
          </div>
        </div>
        {/* o painel de negociação entra ao lado, como no app */}
        <motion.div className={`rounded-[20px] overflow-hidden ring-1 ring-white/10 ${lift} relative`} style={{ width: PANEL_W, opacity: panel, x: panelX }}>
          <Still shot={PANEL} alt={ALT.negotiation} />
          <Spotlight shot={PANEL} box={SPOTS.negotiation.payment} opacity={paySpot} dim={0.45} radius={16} />
        </motion.div>
      </div>
    </div>
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
