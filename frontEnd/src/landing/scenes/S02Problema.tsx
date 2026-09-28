/**
 * 02 — O PROBLEMA. Depois do trailer, silêncio: só texto no escuro.
 * Uma frase, a virada ("outra história"), as dúvidas que todo mundo tem, e a resposta.
 * Nenhuma imagem de propósito: o contraste com a cena anterior prepara a solução.
 */
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Scene, Reveal, ChapterMark, headlineClass, sceneSize } from "../primitives";
import { COPY } from "../story";
import { useBand, useFade } from "../motion";

const T = COPY.problema;
// posição de cada dúvida no espaço negativo (em % da tela)
const PLACES = [
  { left: "12%", top: "22%" },
  { left: "66%", top: "30%" },
  { left: "18%", top: "70%" },
  { left: "62%", top: "74%" },
];

export default function S02Problema({ cinematic }: { cinematic: boolean }) {
  return (
    <Scene id="o-problema" length={3.2} cinematic={cinematic} labelledBy="problema-title" still={<Still02 />}>
      {(p) => <Film p={p} />}
    </Scene>
  );
}

function Film({ p }: { p: MotionValue<number> }) {
  const markOpacity = useFade(p, 0.02, 0.08, 0.7, 0.76);
  const line1 = useTransform(p, [0.04, 0.12, 0.22, 0.3, 0.7, 0.76], [0, 1, 1, 0.28, 0.28, 0], { clamp: true });
  const line1Y = useBand(p, [0.04, 0.14], 24, 0);
  const line2 = useFade(p, 0.16, 0.26, 0.7, 0.76);
  const line2Y = useBand(p, [0.16, 0.28], 24, 0);
  const linesDim = useBand(p, [0.32, 0.4], 1, 0.22);
  const answer = useBand(p, [0.8, 0.88], 0, 1);
  const answerY = useBand(p, [0.8, 0.9], 30, 0);

  return (
    <div className="absolute inset-0">
      <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ opacity: linesDim }}>
        <ChapterMark id="o-problema" className="mb-10" style={{ opacity: markOpacity }} />
        <motion.p className="font-medium tracking-[-0.02em] text-[clamp(1.6rem,3vw,3rem)] text-[var(--text-muted)]" style={{ opacity: line1, y: line1Y }}>
          {T.lines[0]}
        </motion.p>
        <motion.h2 id="problema-title" className={`mt-4 max-w-5xl ${headlineClass} ${sceneSize}`} style={{ opacity: line2, y: line2Y }}>
          {T.lines[1]}
        </motion.h2>
      </motion.div>

      {T.questions.map((q, i) => (
        <Question key={q} p={p} text={q} index={i} place={PLACES[i]} />
      ))}

      <motion.p className={`absolute inset-0 flex items-center justify-center ${headlineClass} ${sceneSize}`} style={{ opacity: answer, y: answerY }}>
        {T.answer[0]}&nbsp;<span className="text-[var(--primary)]">{T.answer[1]}</span>
      </motion.p>
    </div>
  );
}

function Question({ p, text, index, place }: { p: MotionValue<number>; text: string; index: number; place: { left: string; top: string } }) {
  const start = 0.36 + index * 0.06;
  const opacity = useFade(p, start, start + 0.05, 0.68, 0.74);
  const y = useBand(p, [start, start + 0.07], 16, 0);
  return (
    <motion.p className="absolute text-[clamp(1.1rem,1.8vw,1.6rem)] font-medium text-[var(--text)]/85 tracking-[-0.01em]" style={{ ...place, opacity, y }}>
      {text}
    </motion.p>
  );
}

function Still02() {
  return (
    <div className="py-28 md:py-40 px-6 max-w-5xl mx-auto text-center">
      <Reveal>
        <ChapterMark id="o-problema" className="mb-8" />
        <p className="text-xl md:text-2xl text-[var(--text-muted)]">{T.lines[0]}</p>
        <h2 id="problema-title" className={`mt-3 ${headlineClass} text-[clamp(2rem,7vw,4.5rem)]`}>{T.lines[1]}</h2>
      </Reveal>
      <ul className="mt-14 grid sm:grid-cols-2 gap-x-10 gap-y-5 text-lg text-[var(--text)]/85">
        {T.questions.map((q, i) => (
          <li key={q}>
            <Reveal delay={0.08 * i}>{q}</Reveal>
          </li>
        ))}
      </ul>
      <Reveal delay={0.2} className="mt-16">
        <p className={`${headlineClass} text-[clamp(1.9rem,6vw,3.5rem)]`}>
          {T.answer[0]} <span className="text-[var(--primary)]">{T.answer[1]}</span>
        </p>
      </Reveal>
    </div>
  );
}
