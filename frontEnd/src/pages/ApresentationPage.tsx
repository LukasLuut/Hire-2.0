// src/pages/ApresentationPage.tsx
// Página inicial de quem não está logado (rota "/" e "/apresentacao"): o Hire contado como uma história.
// Encontre → o problema → descubra → conheça → confie → converse → contrate → mostre → compartilhe → ecossistema.
// Roteiro e textos: src/landing/story.ts · tomadas reais do app: public/landing/story (scripts/landing-capture)
// · direção de cada cena: docs/landing/STORYBOARD.md.
// No desktop a câmera é conduzida pelo scroll: rolar para baixo toca a cena atual até o fim e para
// (src/landing/playback.ts); rolar para cima revisa livremente. No celular e com movimento reduzido
// cada cena tem uma composição estática própria, com o mesmo conteúdo.

import { MotionConfig, motion, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useCinematic } from "../landing/motion";
import { useScenePlayback } from "../landing/playback";
import { CONTINUE_HINT } from "../landing/story";
import ChapterRail from "../landing/ChapterRail";
import S01Encontre from "../landing/scenes/S01Encontre";
import S02Problema from "../landing/scenes/S02Problema";
import S03Descubra from "../landing/scenes/S03Descubra";
import S04Conheca from "../landing/scenes/S04Conheca";
import S05Confie from "../landing/scenes/S05Confie";
import S06Converse from "../landing/scenes/S06Converse";
import S07Contrate from "../landing/scenes/S07Contrate";
import S08Mostre from "../landing/scenes/S08Mostre";
import S09Compartilhe from "../landing/scenes/S09Compartilhe";
import S10Ecossistema from "../landing/scenes/S10Ecossistema";
import FinalCta from "../landing/scenes/FinalCta";
import SharedPhoto from "../landing/sharedPhoto";
import NavPeek from "../landing/navPeek";

export default function LandingPage() {
  const cinematic = useCinematic();
  const hint = useScenePlayback(cinematic);
  const hintY = useTransform(hint, [0, 1], [8, 0]);
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full overflow-x-clip bg-[var(--bg-dark)] text-[var(--text)]">
        {cinematic && <ChapterRail />}
        {cinematic && <NavPeek />}
        {cinematic && (
          // a cena parou: a história continua quando o visitante quiser
          <motion.p
            aria-hidden
            className="fixed bottom-7 left-1/2 z-40 flex flex-col items-center gap-1.5 text-[11px] tracking-[0.2em] uppercase text-[var(--text-muted)] pointer-events-none"
            style={{ opacity: hint, x: "-50%", y: hintY }}
          >
            {CONTINUE_HINT}
            <ChevronDown size={15} />
          </motion.p>
        )}
        <S01Encontre cinematic={cinematic} />
        <S02Problema cinematic={cinematic} />
        <S03Descubra cinematic={cinematic} />
        {/* a foto da saída dos noivos atravessa as duas cenas, parada na tela (landing/sharedPhoto.tsx) */}
        <div className="relative">
          {cinematic && <SharedPhoto />}
          <S04Conheca cinematic={cinematic} />
          <S05Confie cinematic={cinematic} />
        </div>
        <S06Converse cinematic={cinematic} />
        <S07Contrate cinematic={cinematic} />
        <S08Mostre cinematic={cinematic} />
        <S09Compartilhe cinematic={cinematic} />
        <S10Ecossistema cinematic={cinematic} />
        <FinalCta />
      </div>
    </MotionConfig>
  );
}
