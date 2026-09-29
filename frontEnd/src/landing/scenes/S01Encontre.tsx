/**
 * 01 — ENCONTRE. Abertura: escuro, a marca, e então o produto real se revela.
 * Busca vazia → "Fotógrafo para eventos" digitado letra por letra → resultados → destaque no card do Tomás →
 * a câmera entra na foto de capa do card, que cresce até virar o cenário → "Encontre quem faz."
 * (o perfil e o portfólio ficam para a cena 04). Todas as telas são tomadas reais do app (scripts/landing-capture).
 */
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Scene, Still, Spotlight, PrimaryCta, Reveal, headlineClass, displaySize } from "../primitives";
import { shot, photoSrcSet, pct, SPOTS, originOf, type ShotName } from "../media";
import { COPY, ALT, BRAND, ROUTES } from "../story";
import { EASE, useBand, useFade, useKeys } from "../motion";

// um quadro por letra de "Fotógrafo para eventos" (tomadas reais da digitação)
const TYPE_FRAMES = Array.from({ length: COPY.encontre.query.length + 1 }, (_, i) => shot(`search-type-${String(i).padStart(2, "0")}` as ShotName));
const LAST = TYPE_FRAMES.length - 1;
const RESULTS = shot("search-results");
const PHOTO = shot("photo-field-walk");
const COVER = SPOTS.results.tomasCover;

// a barra digitada ocupa, dentro da tomada de resultados, a mesma faixa da barra real (tomadas do mesmo recorte)
const TYPE_BOX = { left: `${(70 / 1360) * 100}%`, width: `${(1220 / 1360) * 100}%` };
// só a pílula da barra (a tomada da digitação tem um retângulo de fundo em volta, que aparecia como uma barra escura)
const PILL = "inset(22.6% 3.9% 21.7% 2.5% round 999px)";
// bordas da página esfumadas: a tela do app se funde ao fundo, sem um retângulo mais escuro
const FEATHER = "linear-gradient(to right, transparent, #000 3%, #000 97%, transparent)";
// largura da página de resultados na tela (a mesma do className abaixo)
const pageWidth = (vw: number) => Math.min(1120, vw * 0.8);
// para levar a capa do card ao centro: a distância do centro da capa ao centro da tomada (em % da própria tomada)
const COVER_X = `${((RESULTS.width / 2 - (COVER.x + COVER.w / 2)) / RESULTS.width) * 100}%`;
const COVER_Y = `${((RESULTS.height / 2 - (COVER.y + COVER.h / 2)) / RESULTS.height) * 100}%`;
const T = COPY.encontre;

export default function S01Encontre({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="encontre" cinematic={cinematic} labelledBy="encontre-title" still={<Still01 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

/** Quanto a capa precisa crescer para cobrir a tela inteira */
function coverFill() {
  const w = pageWidth(window.innerWidth);
  const coverW = (COVER.w / RESULTS.width) * w;
  const coverH = (COVER.h / RESULTS.width) * w;
  return Math.max(window.innerWidth / coverW, window.innerHeight / coverH) * 1.04;
}
function useCoverFill() {
  const [k, setK] = useState(coverFill);
  useEffect(() => {
    const onResize = () => setK(coverFill());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return k;
}

function Film({ p }: { p: MotionValue<number> }) {
  // ---- abertura: a marca
  const brandOpacity = useBand(p, [0.04, 0.1], 1, 0);
  const brandScale = useBand(p, [0.04, 0.11], 1, 0.94);
  const brandY = useBand(p, [0.04, 0.11], 0, -50);

  // ---- a busca real entra e é digitada
  // a busca só entra quando a marca já saiu (uma coisa de cada vez)
  const pageOpacity = useFade(p, 0.1, 0.15, 0.67, 0.7);
  const pageScale = useBand(p, [0.1, 0.15], 0.97, 1);
  // enquanto digita, a barra fica no centro da tela; os resultados abrem e a página sobe junto
  const pageY = useKeys(p, [0.26, 0.36], ["44%", "0%"]);
  const [typed, setTyped] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = Math.max(0, Math.min(LAST, Math.floor(((v - 0.14) / 0.12) * (LAST + 1))));
    setTyped((prev) => (prev === i ? prev : i));
  });
  const typeOpacity = useBand(p, [0.265, 0.275], 1, 0);
  // busca → resultados: a lista desce a partir da barra, com a borda de baixo esfumada (nada de corte seco)
  const reveal = useBand(p, [0.26, 0.36], 92, 0);
  const revealMask = useTransform(reveal, (v) => `linear-gradient(to bottom, #000 ${Math.max(0, 100 - v - 6)}%, transparent ${100 - v}%)`);
  const spot = useFade(p, 0.38, 0.42, 0.48, 0.52);

  // ---- a câmera entra na capa do card: ela cresce, vai ao centro e vira o cenário
  // escala, deslocamento e foto andam juntos, num movimento só (antes terminavam em momentos diferentes)
  const fill = useCoverFill();
  const camScale = useKeys(p, [0.46, 0.66], [1, fill]);
  const camX = useKeys(p, [0.46, 0.66], ["0%", COVER_X]);
  const camY = useKeys(p, [0.46, 0.66], ["0%", COVER_Y]);
  // a foto em alta sobre a capa (esconde a etiqueta do card e mantém a imagem nítida enquanto cresce)
  const coverPhoto = useBand(p, [0.47, 0.53], 0, 1);
  // a mesma foto, em tela cheia, assume quando a capa já cobre a tela
  const photoOpacity = useBand(p, [0.62, 0.67], 0, 1);
  // a aproximação lenta da foto anda no tempo (não no scroll): segue contínua mesmo com a cena parada
  const drift = useMotionValue(1);
  const drifting = useRef(false);
  useMotionValueEvent(p, "change", (v) => {
    const on = v > 0.66;
    if (on === drifting.current) return;
    drifting.current = on;
    animate(drift, on ? 1.06 : 1, on ? { duration: 16, ease: [0.25, 0.1, 0.25, 1] } : { duration: 0.8, ease: "easeOut" });
  });
  const photoShade = useBand(p, [0.68, 0.78], 0, 1);
  const titleOpacity = useBand(p, [0.74, 0.84], 0, 1);
  const titleY = useBand(p, [0.74, 0.84], 30, 0);
  const ctaOpacity = useBand(p, [0.86, 0.92], 0, 1);
  // invisível = fora do Tab (o botão só existe para o teclado quando aparece)
  const ctaVisibility = useTransform(ctaOpacity, (v) => (v > 0.05 ? "visible" : "hidden"));

  return (
    // o fundo da página pintado aqui: a busca é misturada com ele (lighten), então nenhuma sombra ou artefato
    // da tomada fica mais escuro que o fundo — eram as "manchas pretas" em volta da barra e dos resultados
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-dark)]">
      {/* a marca */}
      <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ opacity: brandOpacity, scale: brandScale, y: brandY }}>
        <motion.p
          className="font-semibold tracking-[-0.05em] leading-none text-[clamp(5rem,16vw,15rem)]"
          initial={{ opacity: 0, filter: "blur(14px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          {BRAND}
        </motion.p>
        <motion.p className="mt-6 text-lg md:text-xl text-[var(--text-muted)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.9 }}>
          {T.opening}
        </motion.p>
        <motion.span className="absolute bottom-10 flex flex-col items-center gap-2 text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ duration: 1, delay: 1.8 }}>
          {T.scrollHint}
          <ChevronDown size={16} aria-hidden />
        </motion.span>
      </motion.div>

      {/* busca → resultados → capa do card (a mesma página, recortada da tomada real) */}
      <motion.div className="relative w-[min(1120px,80vw)]" style={{ opacity: pageOpacity, scale: pageScale, y: pageY, mixBlendMode: "lighten" }}>
        <motion.div style={{ scale: camScale, x: camX, y: camY, transformOrigin: originOf(RESULTS, COVER) }}>
          <div style={{ maskImage: FEATHER }}>
          <motion.div className="relative" style={{ maskImage: revealMask }}>
            <Still shot={RESULTS} alt={ALT.results} priority />
            <Spotlight shot={RESULTS} box={SPOTS.results.tomasCard} opacity={spot} />
            <motion.img
              src={PHOTO.src}
              srcSet={photoSrcSet(PHOTO)}
              sizes="100vw"
              alt=""
              aria-hidden
              decoding="async"
              className="absolute object-cover rounded-t-[10px]"
              style={{ ...pct(RESULTS, COVER), opacity: coverPhoto }}
            />
          </motion.div>
          </div>
          <motion.div className="absolute top-0" style={{ ...TYPE_BOX, opacity: typeOpacity, clipPath: PILL }}>
            {TYPE_FRAMES.map((f, i) => (
              <img
                key={f.name}
                src={f.src}
                width={f.width}
                height={f.height}
                alt={i === LAST ? ALT.search : ""}
                decoding="async"
                className={`w-full h-auto ${i === 0 ? "relative" : "absolute inset-0"}`}
                style={{ opacity: i === typed ? 1 : 0 }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* cenário final: a foto da capa, agora em tela cheia */}
      <motion.div className="absolute inset-0" style={{ opacity: photoOpacity }} aria-hidden>
        <motion.img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ scale: drift }} />
        <motion.div className="absolute inset-0" style={{ opacity: photoShade }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.3),rgba(0,0,0,0.78)_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--bg-dark)] to-transparent" />
        </motion.div>
      </motion.div>

      {/* a mensagem */}
      <div className="absolute inset-x-0 bottom-[12vh] flex flex-col items-center text-center px-6">
        <motion.h1 id="encontre-title" className={`${headlineClass} ${displaySize}`} style={{ opacity: titleOpacity, y: titleY }}>
          {T.headline}
        </motion.h1>
        <motion.div className="mt-9 flex flex-col items-center gap-5" style={{ opacity: ctaOpacity, visibility: ctaVisibility }}>
          <p className="max-w-xl text-base md:text-lg text-[var(--text-muted)]">{T.support}</p>
          <PrimaryCta to={ROUTES.explore}>{T.cta}</PrimaryCta>
        </motion.div>
      </div>
    </div>
  );
}

/** A busca real digitando "Fotógrafo" uma vez, quando aparece (celular); parada no fim com movimento reduzido */
function TypingOnce() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setTyped(LAST);
    const t = window.setInterval(() => setTyped((i) => (i >= LAST ? (window.clearInterval(t), LAST) : i + 1)), 95);
    return () => window.clearInterval(t);
  }, [inView, reduce]);
  return (
    // só o começo da barra (onde o texto é digitado), ampliado: a tomada inteira é larga demais para o celular
    <div ref={ref} className="mx-auto w-[min(420px,88vw)] overflow-hidden rounded-full ring-1 ring-white/15" style={{ clipPath: "inset(0% 0% 0% 0% round 999px)" }}>
      <div className="relative w-[170%]" style={{ clipPath: "inset(0% 0% 12% 0%)", marginBottom: "-1.2%" }}>
        {TYPE_FRAMES.map((f, i) => (
          <img
            key={f.name}
            src={f.src}
            width={f.width}
            height={f.height}
            alt={i === LAST ? ALT.search : ""}
            loading="lazy"
            decoding="async"
            className={`w-full h-auto ${i === 0 ? "relative" : "absolute inset-0"}`}
            style={{ opacity: i === typed ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Celular e movimento reduzido: a mesma abertura, composta sem coreografia */
function Still01() {
  return (
    <div className="relative min-h-[100svh] flex flex-col">
      {/* a foto do portfólio do Tomás como cenário: a história começa pelo trabalho de alguém */}
      <img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" aria-hidden fetchPriority="high" className="absolute inset-0 w-full h-full object-cover object-[40%_center]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-[var(--bg-dark)]" aria-hidden />
      <div className="relative flex-1 pt-28 pb-14 px-5 flex flex-col items-center justify-end text-center">
        <Reveal>
          <p className="font-semibold tracking-[-0.05em] leading-none text-[clamp(4.5rem,22vw,9rem)]">{BRAND}</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-7 w-full">
          <TypingOnce />
        </Reveal>
        <Reveal delay={0.15}>
          <h1 id="encontre-title" className={`mt-6 ${headlineClass} text-[clamp(2.25rem,9vw,4.5rem)]`}>{T.headline}</h1>
          <p className="mt-5 mx-auto max-w-md text-[var(--text)]/80">{T.support}</p>
          <div className="mt-8">
            <PrimaryCta to={ROUTES.explore}>{T.cta}</PrimaryCta>
          </div>
        </Reveal>
      </div>
      <div className="relative hidden lg:flex justify-center px-5 pb-20">
        <Reveal className="w-[min(1000px,90vw)]">
          <div className="overflow-hidden rounded-[18px] ring-1 ring-white/10">
            <Still shot={RESULTS} alt={ALT.results} />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
