/**
 * 01 — ENCONTRE. Abertura: escuro, a marca, e então o produto real se revela.
 * Busca vazia → "Fotógrafo" digitado letra por letra → resultados → o card do Tomás cresce e vira
 * o perfil → o portfólio sobe → a câmera se afasta, a foto dele vira o cenário e surge "Encontre quem faz."
 * Todas as telas são tomadas reais do app (scripts/landing-capture).
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Scene, Still, Frame, Spotlight, PrimaryCta, Reveal, headlineClass, displaySize } from "../primitives";
import { shot, photoSrcSet, SPOTS, originOf, type ShotName } from "../media";
import { COPY, ALT, BRAND, ROUTES } from "../story";
import { EASE, useBand, useFade } from "../motion";

const TYPE_FRAMES = Array.from({ length: 10 }, (_, i) => shot(`search-type-${String(i).padStart(2, "0")}` as ShotName));
const RESULTS = shot("search-results");
const HERO = shot("profile-hero");
const PORTFOLIO = shot("profile-portfolio");
const PHOTO = shot("photo-field-walk");

// a barra digitada ocupa, dentro da tomada de resultados, a mesma faixa da barra real (tomadas do mesmo recorte)
const TYPE_BOX = { left: `${(70 / 1360) * 100}%`, width: `${(1220 / 1360) * 100}%` };
const T = COPY.encontre;

export default function S01Encontre({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="encontre" length={5.4} cinematic={cinematic} labelledBy="encontre-title" still={<Still01 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  // ---- abertura: a marca
  const brandOpacity = useBand(p, [0.035, 0.1], 1, 0);
  const brandScale = useBand(p, [0.035, 0.1], 1, 0.92);
  const brandY = useBand(p, [0.035, 0.1], 0, -60);

  // ---- a busca real entra e é digitada
  const pageOpacity = useFade(p, 0.07, 0.12, 0.46, 0.5);
  const pageScale = useBand(p, [0.07, 0.13], 0.96, 1);
  // enquanto digita, a barra fica no centro da tela; os resultados abrem e a página sobe junto
  const pageY = useTransform(p, [0.24, 0.34], ["44%", "0%"], { clamp: true });
  const [typed, setTyped] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = Math.max(0, Math.min(9, Math.floor(((v - 0.12) / 0.11) * 10)));
    setTyped((prev) => (prev === i ? prev : i));
  });
  const typeOpacity = useBand(p, [0.245, 0.255], 1, 0);
  // busca → resultados: a lista desce a partir da barra
  const reveal = useBand(p, [0.24, 0.34], 92, 0);
  const clipPath = useTransform(reveal, (v) => `inset(0% 0% ${v}% 0% round 16px)`);
  const spot = useFade(p, 0.35, 0.4, 0.44, 0.47);

  // ---- o card do Tomás cresce e vira o perfil (push-in no card)
  const camScale = useBand(p, [0.42, 0.5], 1, 1.7);
  // o card vem para o centro enquanto cresce
  const camX = useTransform(p, [0.42, 0.5], ["0%", "36%"], { clamp: true });
  const camY = useTransform(p, [0.42, 0.5], ["0%", "-15%"], { clamp: true });
  const heroOpacity = useFade(p, 0.49, 0.54, 0.64, 0.68);
  const heroScale = useTransform(p, [0.49, 0.55, 0.66], [0.9, 1, 1.08], { clamp: true });
  const heroY = useBand(p, [0.62, 0.68], 0, -120);

  // ---- o portfólio sobe (a câmera desce a página)
  const portOpacity = useFade(p, 0.67, 0.72, 0.9, 0.95);
  const portY = useBand(p, [0.67, 0.74], 220, 0);
  const firstSpot = useFade(p, 0.74, 0.77, 0.8, 0.83);
  // pull-out: a interface recua e a foto dele vira o cenário
  const portScale = useBand(p, [0.8, 0.9], 1, 0.56);
  const photoOpacity = useBand(p, [0.8, 0.9], 0, 1);
  const photoScale = useBand(p, [0.8, 1], 1.18, 1.04);
  const titleOpacity = useBand(p, [0.87, 0.93], 0, 1);
  const titleY = useBand(p, [0.87, 0.93], 30, 0);
  const ctaOpacity = useBand(p, [0.92, 0.96], 0, 1);
  // invisível = fora do Tab (o botão só existe para o teclado quando aparece)
  const ctaVisibility = useTransform(ctaOpacity, (v) => (v > 0.05 ? "visible" : "hidden"));

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* cenário final: a foto do portfólio do Tomás */}
      <motion.div className="absolute inset-0" style={{ opacity: photoOpacity }} aria-hidden>
        <motion.img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ scale: photoScale }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35),rgba(0,0,0,0.82)_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--bg-dark)] to-transparent" />
      </motion.div>

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

      {/* busca → resultados (a mesma página, recortada da tomada real) */}
      <motion.div className="relative w-[min(1120px,80vw)]" style={{ opacity: pageOpacity, scale: pageScale, y: pageY }}>
        <motion.div style={{ scale: camScale, x: camX, y: camY, transformOrigin: originOf(RESULTS, SPOTS.results.tomasCard) }}>
          <motion.div className="relative" style={{ clipPath }}>
            <Still shot={RESULTS} alt={ALT.results} priority />
            <Spotlight shot={RESULTS} box={SPOTS.results.tomasCard} opacity={spot} />
          </motion.div>
          <motion.div className="absolute top-0" style={{ ...TYPE_BOX, opacity: typeOpacity, clipPath: "inset(0% 0% 12% 0%)" }}>
            {TYPE_FRAMES.map((f, i) => (
              <img
                key={f.name}
                src={f.src}
                width={f.width}
                height={f.height}
                alt={i === 9 ? ALT.search : ""}
                decoding="async"
                className={`w-full h-auto ${i === 0 ? "relative" : "absolute inset-0"}`}
                style={{ opacity: i === typed ? 1 : 0 }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* o perfil */}
      <motion.div className="absolute w-[min(1060px,76vw)]" style={{ opacity: heroOpacity, scale: heroScale, y: heroY, transformOrigin: originOf(HERO, SPOTS.hero.identity) }}>
        <Frame>
          <Still shot={HERO} alt={ALT.hero} />
        </Frame>
      </motion.div>

      {/* o portfólio */}
      <motion.div className="absolute w-[min(1000px,72vw)]" style={{ opacity: portOpacity, y: portY, scale: portScale }}>
        <Frame>
          <Still shot={PORTFOLIO} alt={ALT.portfolio} />
          <Spotlight shot={PORTFOLIO} box={SPOTS.portfolio.first} opacity={firstSpot} radius={14} />
        </Frame>
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
          <Frame>
            <Still shot={RESULTS} alt={ALT.results} />
          </Frame>
        </Reveal>
      </div>
    </div>
  );
}
