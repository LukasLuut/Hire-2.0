/**
 * 10 — O ECOSSISTEMA. A história inteira num traço: uma curva única percorre Cliente → Serviço → Profissional →
 * Orçamento → Contratação, desenhada de ponta a ponta num movimento contínuo, com um ponto de luz à frente.
 * Cada etapa acende quando o traço chega nela — com o pedaço real do app em que aquilo aconteceu —, depois
 * tudo converge para a marca. Termina no convite: é o fechamento da página.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Crop, ChapterMark, Reveal, PrimaryCta, GhostCta, headlineClass, sceneSize, lift } from "../primitives";
import { shot, SPOTS, type Box, type Shot } from "../media";
import { COPY, BRAND, ROUTES } from "../story";
import { SMOOTH, useBand } from "../motion";

const T = COPY.ecossistema;
const F = COPY.final;
const ROOM = shot("chat-room");
const RESULTS = shot("search-results");
const HERO = shot("profile-hero");
const PANEL = shot("negotiation-panel");
const CONTRACT = shot("contract-signed");

/** Uma etapa: o ponto na curva (em % da tela) e o recorte do app, acima ou abaixo do ponto */
type Node = { label: string; shot: Shot; box: Box; alt: string; x: number; y: number; w: string; above: boolean; round?: boolean };
const NODES: Node[] = [
  { label: T.nodes[0], shot: ROOM, box: SPOTS.chatRoom.juliaAsk, alt: "Mensagem da Júlia pedindo o casamento com pré-wedding", x: 12, y: 60, w: "17vw", above: false },
  { label: T.nodes[1], shot: RESULTS, box: SPOTS.results.tomasService, alt: "Serviço Fotografia de Casamento", x: 31, y: 42, w: "13vw", above: true },
  { label: T.nodes[2], shot: HERO, box: SPOTS.hero.avatar, alt: "Foto do Tomás Albuquerque", x: 50, y: 60, w: "7.5vw", above: false, round: true },
  { label: T.nodes[3], shot: PANEL, box: SPOTS.negotiation.payment, alt: "Valor combinado: R$ 5.400 no cartão em 3x, acordado", x: 69, y: 42, w: "15vw", above: true },
  { label: T.nodes[4], shot: CONTRACT, box: SPOTS.contract.signatures, alt: "Assinaturas da Júlia e do Tomás no contrato", x: 88, y: 60, w: "17vw", above: false },
];

// a curva: Catmull-Rom pelos pontos (começa um pouco antes da primeira etapa e termina depois da última)
type Pt = { x: number; y: number };
const POINTS: Pt[] = [{ x: 3, y: 66 }, ...NODES.map((n) => ({ x: n.x, y: n.y })), { x: 97, y: 54 }];
function curve(pts: Pt[]) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const PATH = curve(POINTS);
// o traço inteiro é desenhado nesta faixa, num movimento só (o play dá a ela tempo próprio: timing.ts)
const DRAW = [0.06, 0.54];

export default function S10Ecossistema({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="ecossistema" cinematic={cinematic} labelledBy="ecossistema-title" still={<Still10 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  // sai só depois da pausa com o traço completo
  const title = useBand(p, [0.56, 0.62], 1, 0);
  // linear aqui: a timeline do play já acelera e desacelera o traço
  const draw = useTransform(p, DRAW, [0, 1], { clamp: true });
  const stage = useBand(p, [0.6, 0.68], 1, 0);
  const brand = useBand(p, [0.62, 0.74], 0, 1);
  const brandScale = useBand(p, [0.6, 0.76], 0.7, 1);
  const headline = useBand(p, [0.74, 0.84], 0, 1);
  const headlineY = useBand(p, [0.74, 0.84], 24, 0);
  const cta = useBand(p, [0.86, 0.94], 0, 1);
  const ctaY = useBand(p, [0.86, 0.94], 16, 0);
  // invisível = fora do Tab
  const ctaVisibility = useTransform(cta, (v) => (v > 0.05 ? "visible" : "hidden"));

  // onde cada etapa fica ao longo do traço (fração do comprimento) e a posição do ponto de luz
  const pathRef = useRef<SVGPathElement>(null);
  const [marks, setMarks] = useState<number[]>(() => NODES.map((_, i) => (i + 1) / (NODES.length + 1)));
  const headX = useMotionValue(POINTS[0].x);
  const headY = useMotionValue(POINTS[0].y);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    setMarks(
      NODES.map((_, i) => {
        probe.setAttribute("d", curve(POINTS.slice(0, i + 2)));
        return probe.getTotalLength() / total;
      }),
    );
  }, []);
  useMotionValueEvent(draw, "change", (v) => {
    const path = pathRef.current;
    if (!path) return;
    const pt = path.getPointAtLength(v * path.getTotalLength());
    headX.set(pt.x);
    headY.set(pt.y);
  });
  const headLeft = useTransform(headX, (v) => `${v}%`);
  const headTop = useTransform(headY, (v) => `${v}%`);
  const headOpacity = useTransform(draw, [0, 0.02, 0.97, 1], [0, 1, 1, 0]);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-x-0 top-[10vh] text-center z-10" style={{ opacity: title }}>
        <ChapterMark id="ecossistema" />
      </motion.div>

      <motion.div className="absolute inset-0" style={{ opacity: stage }}>
        {/* o trilho (apagado) e o traço na cor do Hire, com brilho */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="eco-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="45%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="color-mix(in oklch, var(--primary) 60%, white)" />
            </linearGradient>
          </defs>
          <path d={PATH} fill="none" stroke="white" strokeOpacity={0.08} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 6" />
          <motion.path d={PATH} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={9} vectorEffect="non-scaling-stroke" strokeLinecap="round" style={{ pathLength: draw, filter: "blur(8px)" }} />
          <motion.path ref={pathRef} d={PATH} fill="none" stroke="url(#eco-stroke)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" style={{ pathLength: draw }} />
        </svg>
        {/* o ponto de luz na frente do traço */}
        <motion.span
          aria-hidden
          className="absolute h-3 w-3 -ml-1.5 -mt-1.5 rounded-full bg-white shadow-[0_0_18px_6px_color-mix(in_oklch,var(--primary)_70%,transparent)]"
          style={{ left: headLeft, top: headTop, opacity: headOpacity }}
        />
        {NODES.map((n, i) => (
          <NodeView key={n.label} draw={draw} p={p} node={n} index={i} at={marks[i]} />
        ))}
      </motion.div>

      <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ opacity: brand }}>
        <motion.p className="font-semibold tracking-[-0.05em] leading-none text-[clamp(4.5rem,12vw,11rem)]" style={{ scale: brandScale }}>
          {BRAND}
        </motion.p>
        <motion.h2 id="ecossistema-title" className={`mt-8 ${headlineClass} ${sceneSize}`} style={{ opacity: headline, y: headlineY }}>
          {T.headline[0]} <span className="block text-[var(--text-muted)]">{T.headline[1]}</span>
        </motion.h2>
        <motion.div className="mt-10 flex flex-col sm:flex-row items-center gap-3" style={{ opacity: cta, y: ctaY, visibility: ctaVisibility }}>
          <PrimaryCta to={ROUTES.explore}>{F.cta}</PrimaryCta>
          <GhostCta to={ROUTES.provider}>{F.secondary}</GhostCta>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Uma etapa: acende quando o traço chega ao ponto dela e, no fim, converge para o centro junto com as outras */
function NodeView({ draw, p, node, index, at }: { draw: MotionValue<number>; p: MotionValue<number>; node: Node; index: number; at: number }) {
  const on = useTransform(draw, [at - 0.015, at + 0.05], [0, 1], { clamp: true, ease: SMOOTH });
  const dot = useTransform(draw, [at - 0.01, at + 0.01], [0, 1], { clamp: true, ease: SMOOTH });
  const rise = useTransform(on, [0, 1], [node.above ? 14 : -14, 0]);
  const settle = useTransform(on, [0, 1], [0.94, 1]);
  // convergência: cada etapa viaja até o centro e some dentro da marca
  const cx = useTransform(p, [0.56, 0.68], ["0vw", `${50 - node.x}vw`], { clamp: true, ease: SMOOTH });
  const cy = useTransform(p, [0.56, 0.68], ["0vh", `${50 - node.y}vh`], { clamp: true, ease: SMOOTH });
  const shrink = useTransform(p, [0.56, 0.68], [1, 0.3], { clamp: true, ease: SMOOTH });
  return (
    <motion.div className="absolute" style={{ left: `${node.x}%`, top: `${node.y}%`, x: cx, y: cy, scale: shrink }}>
      {/* o ponto na curva */}
      <motion.span aria-hidden className="absolute -left-[7px] -top-[7px] h-[14px] w-[14px] rounded-full bg-[var(--bg-dark)] ring-2 ring-[var(--primary)]" style={{ scale: dot }} />
      {/* o recorte do app, acima ou abaixo do ponto, com o número e o nome da etapa */}
      <motion.figure
        className={`absolute left-0 -translate-x-1/2 m-0 flex items-center gap-3 ${node.above ? "flex-col-reverse bottom-[26px]" : "flex-col top-[26px]"}`}
        style={{ width: node.w, opacity: on, y: rise, scale: settle }}
      >
        <Crop shot={node.shot} box={node.box} alt={node.alt} rounded={node.round ? "rounded-full" : "rounded-2xl"} className={`w-full ring-1 ring-white/12 ${lift}`} />
        <figcaption className="text-center text-xs tracking-[0.18em] uppercase text-[var(--text-muted)] whitespace-nowrap">
          <span className="text-[var(--primary)] tabular-nums mr-2">{String(index + 1).padStart(2, "0")}</span>
          {node.label}
        </figcaption>
      </motion.figure>
    </motion.div>
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
              <p className="mb-3 text-xs tracking-[0.18em] uppercase text-[var(--text-muted)]">
                <span className="text-[var(--primary)] tabular-nums mr-2">{String(i + 1).padStart(2, "0")}</span>
                {n.label}
              </p>
              <div className={n.round ? "w-28 mx-auto" : ""}>
                <Crop shot={n.shot} box={n.box} alt={n.alt} rounded={n.round ? "rounded-full" : "rounded-2xl"} className="ring-1 ring-white/12" />
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
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <PrimaryCta to={ROUTES.explore}>{F.cta}</PrimaryCta>
          <GhostCta to={ROUTES.provider}>{F.secondary}</GhostCta>
        </div>
      </Reveal>
    </div>
  );
}
