/**
 * Rodapé da apresentação. O fechamento (marca, frase e botões) é o fim da cena 10 — aqui fica só
 * o acesso de quem já tem conta e os créditos.
 */
import { COPY, ROUTES } from "../story";
import { Link } from "react-router-dom";
import { PHOTO_CREDITS } from "../credits.gen";

const T = COPY.final;

export default function FinalCta() {
  return (
    <footer className="relative flex flex-col">
      <div className="flex justify-center px-6 py-14">
        <Link to={ROUTES.login} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {T.login}
        </Link>
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
