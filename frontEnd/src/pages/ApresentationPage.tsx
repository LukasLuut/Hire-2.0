// src/pages/ApresentationPage.tsx
// Página inicial de quem não está logado (rota "/" e "/apresentacao"): o Hire contado como uma história.
// Encontre → o problema → descubra → conheça → confie → converse → contrate → mostre → compartilhe → ecossistema.
// Roteiro e textos: src/landing/story.ts · tomadas reais do app: public/landing/story (scripts/landing-capture)
// · direção de cada cena: docs/landing/STORYBOARD.md.
// No desktop a câmera é conduzida pelo scroll; no celular e com movimento reduzido cada cena tem
// uma composição estática própria, com o mesmo conteúdo.

import { MotionConfig } from "framer-motion";
import { useCinematic } from "../landing/motion";
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

export default function LandingPage() {
  const cinematic = useCinematic();
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full overflow-x-clip bg-[var(--bg-dark)] text-[var(--text)]">
        {cinematic && <ChapterRail />}
        <S01Encontre cinematic={cinematic} />
        <S02Problema cinematic={cinematic} />
        <S03Descubra cinematic={cinematic} />
        <S04Conheca cinematic={cinematic} />
        <S05Confie cinematic={cinematic} />
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
