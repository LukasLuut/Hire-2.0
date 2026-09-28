/** Fechamento: tela limpa, a marca, a promessa e o convite. Sem movimento além da entrada. */
import { Reveal, PrimaryCta, GhostCta, headlineClass } from "../primitives";
import { BRAND, COPY, ROUTES, TAGLINE } from "../story";
import { Link } from "react-router-dom";
import { PHOTO_CREDITS } from "../credits.gen";

const T = COPY.final;

export default function FinalCta() {
  return (
    <footer className="relative min-h-[100svh] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <Reveal>
          <p className="font-semibold tracking-[-0.05em] leading-none text-[clamp(4rem,12vw,10rem)]">{BRAND}</p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className={`mt-6 ${headlineClass} text-[clamp(2rem,4.5vw,4rem)]`}>{TAGLINE}</p>
          <p className="mt-5 mx-auto max-w-xl text-base md:text-lg text-[var(--text-muted)]">{T.support}</p>
        </Reveal>
        <Reveal delay={0.2} className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <PrimaryCta to={ROUTES.explore}>{T.cta}</PrimaryCta>
          <GhostCta to={ROUTES.provider}>{T.secondary}</GhostCta>
        </Reveal>
        <Reveal delay={0.3}>
          <Link to={ROUTES.login} className="mt-6 inline-block text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            {T.login}
          </Link>
        </Reveal>
      </div>
      <div className="py-8 px-6 text-center text-xs text-[var(--text-muted)]/70 border-t border-white/5">
        <p>© {new Date().getFullYear()} Hire. — plataforma de contratação e prestação de serviços</p>
        {/* os perfis da apresentação são fictícios; as fotos dos portfólios têm licença Creative Commons */}
        <details className="mt-3 mx-auto max-w-3xl">
          <summary className="cursor-pointer hover:text-[var(--text)] transition-colors">Perfis de demonstração · créditos das fotos</summary>
          <p className="mt-3">Tomás, Júlia e os demais perfis desta apresentação são fictícios. Fotos dos portfólios via Wikimedia Commons:</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {PHOTO_CREDITS.map((c) => (
              <li key={c.source}>
                <a href={c.source} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 hover:text-[var(--text)]">
                  {c.author}
                </a>{" "}
                ({c.license})
              </li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
