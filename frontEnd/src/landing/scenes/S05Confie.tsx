/**
 * 05 — CONFIE. A foto do portfólio continua como cenário; sobre ela, os sinais de confiança saem
 * do próprio perfil — a ficha verificada, as avaliações reais, o histórico no Hire, a área de atendimento.
 * Nada de infográfico: são recortes da tela real.
 */
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Scene, Still, Crop, ChapterMark, Reveal, headlineClass, sceneSize } from "../primitives";
import { shot, photoSrcSet, SPOTS } from "../media";
import { COPY, ALT } from "../story";
import { useBand, useFade } from "../motion";

const HERO = shot("profile-hero");
const RESULTS = shot("search-results");
const PHOTO = shot("photo-field-walk");
const REVIEWS = [shot("review-1"), shot("review-2"), shot("review-3")];
const T = COPY.confie;

export default function S05Confie({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="confie" length={3.4} cinematic={cinematic} labelledBy="confie-title" still={<Still05 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const bg = useTransform(p, [0, 0.86, 0.98], [1, 1, 0], { clamp: true });
  const bgScale = useBand(p, [0, 1], 1, 1.08);
  const dim = useBand(p, [0.02, 0.14], 0.55, 0.78);
  const title = useFade(p, 0.03, 0.1, 0.9, 0.96);
  const idOpacity = useFade(p, 0.1, 0.2, 0.9, 0.96);
  const idY = useBand(p, [0.1, 0.22], 60, 0);
  const factsOpacity = useFade(p, 0.62, 0.7, 0.9, 0.96);
  const factsY = useBand(p, [0.62, 0.72], 24, 0);
  const svcOpacity = useFade(p, 0.72, 0.8, 0.9, 0.96);
  const svcY = useBand(p, [0.72, 0.82], 30, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-0" style={{ opacity: bg }} aria-hidden>
        <motion.img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ scale: bgScale }} />
        <motion.div className="absolute inset-0 bg-black" style={{ opacity: dim }} />
      </motion.div>

      <motion.div className="absolute inset-x-0 top-[11vh] text-center px-6" style={{ opacity: title }}>
        <ChapterMark id="confie" />
        <h2 id="confie-title" className={`mt-5 mx-auto max-w-4xl ${headlineClass} ${sceneSize}`}>{T.headline}</h2>
      </motion.div>

      <div className="absolute left-[6vw] right-[9vw] bottom-[8vh] top-[36vh] grid grid-cols-[1.05fr_1fr] gap-[3vw] items-start">
        {/* a ficha do perfil, como está no app */}
        <div className="grid gap-4">
          <motion.div className="rounded-3xl bg-[var(--bg-dark)]/85 ring-1 ring-white/10 p-3 shadow-2xl" style={{ opacity: idOpacity, y: idY }}>
            <Crop shot={HERO} box={SPOTS.hero.identity} alt={ALT.hero} rounded="rounded-2xl" />
          </motion.div>
          <motion.ul className="flex flex-wrap gap-2" style={{ opacity: factsOpacity, y: factsY }}>
            {T.facts.map((f) => (
              <li key={f} className="px-3.5 py-1.5 rounded-full text-sm bg-black/55 ring-1 ring-white/12 text-[var(--text)]/90 backdrop-blur-sm">{f}</li>
            ))}
          </motion.ul>
          <motion.div className="w-[46%]" style={{ opacity: svcOpacity, y: svcY }}>
            <Crop shot={RESULTS} box={SPOTS.results.tomasService} alt="Serviço Fotografia de Casamento: a partir de R$ 3.200, 10 horas" className="ring-1 ring-white/10 shadow-2xl" />
          </motion.div>
        </div>

        {/* avaliações reais, uma a uma */}
        <div className="relative h-full">
          {REVIEWS.map((r, i) => (
            <Review key={r.name} p={p} index={i} src={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Review({ p, index, src }: { p: MotionValue<number>; index: number; src: ReturnType<typeof shot> }) {
  const start = 0.26 + index * 0.1;
  const opacity = useFade(p, start, start + 0.07, 0.9, 0.96);
  const y = useBand(p, [start, start + 0.09], 80, 0);
  const places = [
    { left: "0%", top: "0%", rotate: -1.5 },
    { left: "34%", top: "12%", rotate: 1 },
    { left: "10%", top: "40%", rotate: -0.5 },
  ][index];
  return (
    <motion.div className="absolute w-[58%] rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]" style={{ left: places.left, top: places.top, rotate: places.rotate, opacity, y }}>
      <Still shot={src} alt={`Avaliação ${index + 1} do Tomás`} className="rounded-2xl" />
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
