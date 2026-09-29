/**
 * Menu recolhível da apresentação: no primeiro play a barra de navegação sobe e sai da tela (mais espaço para as
 * cenas); fica só uma setinha no topo, que mostra a barra por alguns segundos. No topo da página a barra volta.
 * A barra (components/Navbar) só reage ao atributo data-nav-hidden no <html> — nada muda no resto do app.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { playhead } from "./playback";
import { NAV_PEEK } from "./story";

const PEEK_MS = 4000;
// perto do topo da página a barra fica sempre visível
const TOP_PX = 40;

export default function NavPeek() {
  const [hidden, setHidden] = useState(false);
  const [peek, setPeek] = useState(false);
  const timer = useRef(0);

  // recolhe quando uma cena começa a tocar
  useMotionValueEvent(playhead, "change", (y) => {
    if (y > TOP_PX) setHidden(true);
  });
  // volta no topo
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY <= TOP_PX) setHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const collapsed = hidden && !peek;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-nav-hidden", collapsed);
  }, [collapsed]);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      document.documentElement.removeAttribute("data-nav-hidden");
    },
    [],
  );

  const show = () => {
    setPeek(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPeek(false), PEEK_MS);
  };

  return (
    <AnimatePresence>
      {collapsed && (
        <motion.button
          type="button"
          onClick={show}
          aria-label={NAV_PEEK}
          title={NAV_PEEK}
          className="fixed top-2 left-1/2 z-50 -translate-x-1/2 grid place-items-center h-7 w-11 rounded-full bg-white/[0.06] ring-1 ring-white/12 text-[var(--text-muted)] backdrop-blur-md hover:text-[var(--text)] hover:bg-white/10 transition-colors"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.45, 0, 0.2, 1] }}
        >
          <ChevronDown size={16} aria-hidden />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
