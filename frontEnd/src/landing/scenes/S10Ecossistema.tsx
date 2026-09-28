/**
 * 10 — O ECOSSISTEMA. As peças da história — a mensagem da Júlia, o serviço, o Tomás, o acordo,
 * as assinaturas — aparecem ligadas por um fio e convergem para a marca. Não é fluxograma:
 * são pedaços reais do app, na ordem em que aconteceram.
 */
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Scene, Crop, ChapterMark, Reveal, headlineClass, sceneSize } from "../primitives";
import { shot, SPOTS, type Box, type Shot } from "../media";
import { COPY, BRAND, TAGLINE } from "../story";
import { useBand, useFade } from "../motion";

const T = COPY.ecossistema;
const ROOM = shot("chat-room");
const RESULTS = shot("search-results");
const HERO = shot("profile-hero");
const PANEL = shot("negotiation-panel");
const CONTRACT = shot("contract-signed");

type Node = { label: string; shot: Shot; box: Box; alt: string; x: number; y: number; w: string };
const NODES: Node[] = [
  { label: T.nodes[0], shot: ROOM, box: SPOTS.chatRoom.juliaAsk, alt: "Mensagem da Júlia pedindo o casamento com pré-wedding", x: 14, y: 36, w: "19vw" },
  { label: T.nodes[1], shot: RESULTS, box: SPOTS.results.tomasService, alt: "Serviço Fotografia de Casamento", x: 33, y: 68, w: "14vw" },
  { label: T.nodes[2], shot: HERO, box: SPOTS.hero.avatar, alt: "Foto do Tomás Albuquerque", x: 51, y: 32, w: "9vw" },
  { label: T.nodes[3], shot: PANEL, box: SPOTS.negotiation.payment, alt: "Valor combinado: R$ 5.400 no cartão em 3x, acordado", x: 69, y: 66, w: "15vw" },
  { label: T.nodes[4], shot: CONTRACT, box: SPOTS.contract.signatures, alt: "Assinaturas da Júlia e do Tomás no contrato", x: 86, y: 38, w: "19vw" },
];

export default function S10Ecossistema({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="ecossistema" length={3.4} cinematic={cinematic} labelledBy="ecossistema-title" still={<Still10 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const title = useFade(p, 0.0, 0.06, 0.46, 0.52);
  const path = useBand(p, [0.08, 0.42], 0, 1);
  const pathOpacity = useFade(p, 0.06, 0.1, 0.5, 0.58);
  const brand = useBand(p, [0.6, 0.72], 0, 1);
  const brandScale = useBand(p, [0.56, 0.74], 0.6, 1);
  const headline = useBand(p, [0.74, 0.82], 0, 1);
  const headlineY = useBand(p, [0.74, 0.84], 24, 0);
  const tagline = useBand(p, [0.86, 0.92], 0, 1);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-x-0 top-[10vh] text-center z-10" style={{ opacity: title }}>
        <ChapterMark id="ecossistema" />
      </motion.div>

      <motion.svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: pathOpacity }} aria-hidden>
        <motion.path
          d={`M ${NODES.map((n) => `${n.x} ${n.y}`).join(" L ")}`}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          style={{ pathLength: path }}
        />
      </motion.svg>

      {NODES.map((n, i) => (
        <NodeView key={n.label} p={p} node={n} index={i} />
      ))}

      <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ opacity: brand }}>
        <motion.p className="font-semibold tracking-[-0.05em] leading-none text-[clamp(4.5rem,12vw,11rem)]" style={{ scale: brandScale }}>
          {BRAND}
        </motion.p>
        <motion.h2 id="ecossistema-title" className={`mt-8 ${headlineClass} ${sceneSize}`} style={{ opacity: headline, y: headlineY }}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </motion.h2>
        <motion.p className="mt-8 text-lg text-[var(--primary)]" style={{ opacity: tagline }}>{TAGLINE}</motion.p>
      </motion.div>
    </div>
  );
}

function NodeView({ p, node, index }: { p: MotionValue<number>; node: Node; index: number }) {
  const start = 0.08 + index * 0.065;
  const appear = useBand(p, [start, start + 0.06], 0, 1);
  const rise = useBand(p, [start, start + 0.07], 24, 0);
  // convergência: cada peça viaja até o centro e some dentro da marca
  const cx = useTransform(p, [0.48, 0.64], ["0vw", `${50 - node.x}vw`], { clamp: true });
  const cy = useTransform(p, [0.48, 0.64], ["0vh", `${50 - node.y}vh`], { clamp: true });
  const scale = useBand(p, [0.48, 0.64], 1, 0.25);
  const fade = useBand(p, [0.56, 0.66], 1, 0);
  const opacity = useTransform([appear, fade], ([a, f]: number[]) => a * f);
  return (
    <motion.figure
      className="absolute -translate-x-1/2 -translate-y-1/2 m-0"
      style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.w, opacity, x: cx, y: cy, scale }}
    >
      <motion.div style={{ y: rise }}>
        <Crop
          shot={node.shot}
          box={node.box}
          alt={node.alt}
          rounded={node.label === T.nodes[2] ? "rounded-full" : "rounded-2xl"}
          className="ring-1 ring-white/12 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)]"
        />
        <figcaption className="mt-3 text-center text-xs tracking-[0.18em] uppercase text-[var(--text-muted)]">{node.label}</figcaption>
      </motion.div>
    </motion.figure>
  );
}

function Still10() {
  return (
    <div className="py-24 md:py-32 px-5 max-w-5xl mx-auto text-center">
      <Reveal>
        <ChapterMark id="ecossistema" />
      </Reveal>
      <ol className="mt-12 grid gap-8 justify-items-center">
        {NODES.map((n, i) => (
          <li key={n.label} className="w-full max-w-sm">
            <Reveal delay={0.05 * i}>
              <p className="mb-3 text-xs tracking-[0.18em] uppercase text-[var(--text-muted)]">{n.label}</p>
              <div className={n.label === T.nodes[2] ? "w-28 mx-auto" : ""}>
                <Crop shot={n.shot} box={n.box} alt={n.alt} rounded={n.label === T.nodes[2] ? "rounded-full" : "rounded-2xl"} className="ring-1 ring-white/12" />
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      <Reveal className="mt-16">
        <p className="font-semibold tracking-[-0.05em] leading-none text-[clamp(4rem,18vw,8rem)]">{BRAND}</p>
        <h2 id="ecossistema-title" className={`mt-6 ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </h2>
      </Reveal>
    </div>
  );
}
