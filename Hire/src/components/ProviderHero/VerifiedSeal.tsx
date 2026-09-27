import { BadgeCheck } from "lucide-react";

/**
 * Selo azul de "Conta verificada" ao lado do nome. O servidor só marca `verified` quando o
 * cadastro está completo e todas as validações passaram (e-mail, identidade e, se empresa, CNPJ).
 * Ícone só; o texto aparece ao passar o mouse ou focar pelo teclado.
 */
export default function VerifiedSeal({ size = 28 }: { size?: number }) {
  return (
    <span className="relative group inline-flex shrink-0 align-middle" tabIndex={0} role="img" aria-label="Conta verificada">
      <BadgeCheck size={size} strokeWidth={2.25} className="text-white" fill="var(--primary)" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-20 whitespace-nowrap px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-xs font-medium
                   opacity-0 translate-y-1 transition duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0"
      >
        Conta verificada
      </span>
    </span>
  );
}
