/**
 * A foto que atravessa as cenas 04 e 05 (a saída dos noivos). É uma camada só, presa à tela durante as duas
 * cenas: a 04 faz a foto crescer do visualizador até a tela cheia, a 05 escurece o fundo e escreve por cima.
 * Assim, na passagem de uma cena para a outra, a foto fica parada — só o conteúdo muda (nada de duas cópias
 * subindo juntas).
 */
import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { shot, photoSrcSet } from "./media";
import { photoLayer } from "./photoLayer";

const PHOTO = shot("photo-sparklers");

// aproximação lenta enquanto a cena 05 está na tela: anda no tempo, não no scroll (sem degraus nas pausas)
const DRIFT = { to: 1.06, seconds: 18 };

export default function SharedPhoto() {
  const drift = useMotionValue(1);
  const scale = useTransform(() => photoLayer.scale.get() * drift.get());

  useEffect(() => {
    const el = document.getElementById("confie");
    if (!el) return;
    let anim: ReturnType<typeof animate> | null = null;
    const io = new IntersectionObserver(
      ([e]) => {
        anim?.stop();
        anim = e.isIntersecting
          ? animate(drift, DRIFT.to, { duration: DRIFT.seconds, ease: [0.25, 0.1, 0.25, 1] })
          : animate(drift, 1, { duration: 1.2, ease: "easeOut" });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      anim?.stop();
    };
  }, [drift]);

  return (
    // do tamanho das duas cenas: a foto fica presa à tela enquanto elas passam e se solta exatamente no fim da 05,
    // saindo junto com o conteúdo dela (uma margem negativa aqui a deixava presa por mais uma tela, atrás da 06)
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div className="absolute inset-0" style={{ opacity: photoLayer.opacity }}>
          <motion.img src={PHOTO.src} srcSet={photoSrcSet(PHOTO)} sizes="100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ scale }} />
          <motion.div className="absolute inset-0 bg-black" style={{ opacity: photoLayer.dim }} />
        </motion.div>
      </div>
    </div>
  );
}
