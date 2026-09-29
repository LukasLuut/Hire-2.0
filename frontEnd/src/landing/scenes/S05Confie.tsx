/**
 * 05 — CONFIE. A foto do portfólio continua como cenário; sobre ela, os sinais de confiança saem
 * do próprio perfil — a ficha verificada e os números dele — e as avaliações reais, uma de cada vez,
 * grandes o bastante para ler. Nada de infográfico: são recortes da tela real.
 */
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Crop, ChapterMark, Reveal, headlineClass, sceneSize, lift } from "../primitives";
import { shot, photoSrcSet, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";
import { photoLayer } from "../photoLayer";

const HERO = shot("profile-hero");
// a saída dos noivos: a última foto que a cena 04 abriu vira o cenário
const PHOTO = shot("photo-sparklers");
const REVIEWS = [shot("review-1"), shot("review-2"), shot("review-3")];
const T = COPY.confie;

export default function S05Confie({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="confie" cinematic={cinematic} labelledBy="confie-title" still={<Still05 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  // o fundo é a foto compartilhada com a cena 04 (sharedPhoto.tsx): aqui só escurece para o texto;
  // a aproximação lenta dela anda no tempo, contínua
  const dim = useBand(p, [0.02, 0.14], 0.55, 0.8);
  useMotionValueEvent(dim, "change", (v) => photoLayer.dim.set(v));
  const title = useFade(p, 0.03, 0.1);
  // a ficha: quem é, com os sinais que o próprio perfil mostra
  const id = useFade(p, 0.1, 0.2);
  const idY = useBand(p, [0.1, 0.2], 30, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-x-0 top-[11vh] text-center px-6" style={{ opacity: title }}>
        <ChapterMark id="confie" />
        <h2 id="confie-title" className={`mt-5 mx-auto max-w-4xl ${headlineClass} ${sceneSize}`}>{T.headline}</h2>
      </motion.div>

      <div className="absolute left-[max(6vw,104px)] right-[9vw] top-[34vh] bottom-[8vh] grid grid-cols-[1.05fr_1fr] gap-[4vw] items-center">
        {/* a ficha do perfil, como está no app */}
        <motion.div className="grid gap-4" style={{ opacity: id, y: idY }}>
          <div className={`rounded-3xl bg-[var(--bg-dark)] ring-1 ring-white/10 p-3 ${lift}`}>
            <Crop shot={HERO} box={SPOTS.hero.identity} alt={ALT.hero} rounded="rounded-2xl" />
          </div>
          <ul className="flex flex-wrap gap-2">
            {T.facts.map((f) => (
              <li key={f} className="px-3.5 py-1.5 rounded-full text-sm bg-black/55 ring-1 ring-white/12 text-[var(--text)]/90 backdrop-blur-sm">{f}</li>
            ))}
          </ul>
        </motion.div>

        {/* avaliações reais, uma de cada vez — lidas inteiras */}
        <div className="relative w-[min(480px,30vw)] justify-self-center" style={{ aspectRatio: `${REVIEWS[0].width} / ${REVIEWS[0].height}` }}>
          {REVIEWS.map((r, i) => (
            <Review key={r.name} p={p} index={i} src={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

// só o cartão da avaliação: a tomada tem uma margem escura em volta da borda arredondada (px medidos na tomada)
const REVIEW_CARD = "inset(0.6% 0.6% 0.6% 0.5% round 4.4% / 4.7%)";
// faixas de entrada de cada avaliação (a anterior sai enquanto a próxima entra)
const REVIEW_IN = [0.22, 0.44, 0.66];

function Review({ p, index, src }: { p: MotionValue<number>; index: number; src: ReturnType<typeof shot> }) {
  const a = REVIEW_IN[index];
  const next = REVIEW_IN[index + 1];
  const last = next === undefined;
  const opacity = useTransform(p, last ? [a, a + 0.08] : [a, a + 0.08, next, next + 0.08], last ? [0, 1] : [0, 1, 1, 0], { clamp: true });
  const y = useTransform(p, last ? [a, a + 0.08] : [a, a + 0.08, next, next + 0.08], last ? [40, 0] : [40, 0, 0, -24], { clamp: true });
  const scale = useTransform(p, last ? [a, a + 0.08] : [next, next + 0.08], last ? [1, 1] : [1, 0.97], { clamp: true });
  return (
    <motion.div className={`absolute inset-0 ${lift}`} style={{ opacity, y, scale }}>
      <Still shot={src} alt={`Avaliação ${index + 1} do Tomás`} style={{ clipPath: REVIEW_CARD }} />
    </motion.div>
  );
}

function Still05() {
  return (
    <div className="relative py-24 md:py-32 px-5 overflow-hidden">
      <img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" aria-hidden loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-dark)] via-transparent to-[var(--bg-dark)]" aria-hidden />
      <div className="relative max-w-6xl mx-auto">
        <Reveal className="text-center">
          <ChapterMark id="confie" />
          <h2 id="confie-title" className={`mt-5 mx-auto max-w-3xl ${headlineClass} text-[clamp(2rem,7vw,3.75rem)]`}>{T.headline}</h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-12">
          <Crop shot={HERO} box={SPOTS.hero.identity} alt={ALT.hero} className="ring-1 ring-white/10" />
          <ul className="mt-4 flex flex-wrap gap-2 justify-center">
            {T.facts.map((f) => (
              <li key={f} className="px-3 py-1.5 rounded-full text-sm bg-black/50 ring-1 ring-white/12">{f}</li>
            ))}
          </ul>
        </Reveal>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {REVIEWS.map((r, i) => (
            <Reveal key={r.name} delay={0.08 * i}>
              <Still shot={r} alt={`Avaliação ${i + 1} do Tomás`} className="rounded-2xl" />
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
