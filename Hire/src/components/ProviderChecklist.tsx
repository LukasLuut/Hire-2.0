import { motion } from "framer-motion";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProviderEntity } from "../interfaces/Entities";
import { nextStepMessage, profileCompleteness, type CompletenessAction } from "../utils/profileCompleteness";
import { providerPath } from "../utils/providerPath";

/* --------------------------------------------------------------------------
 * ProviderChecklist — completude do perfil público do prestador.
 * Percentual = itens concluídos / itens relevantes (ver utils/profileCompleteness);
 * cada pendência tem um atalho. Completo, vira um resumo com link para o perfil.
 * -------------------------------------------------------------------------- */
interface Props {
  provider: ProviderEntity;
  servicesCount: number;
  servicesWithPhoto: number;
  portfolioCount: number;
  onEditProfile: () => void;
  onNewService: () => void;
  onPortfolio: () => void;
}

export default function ProviderChecklist({ provider, servicesCount, servicesWithPhoto, portfolioCount, onEditProfile, onNewService, onPortfolio }: Props) {
  const { items, done, total, percent } = profileCompleteness(provider, { services: servicesCount, servicesWithPhoto, portfolio: portfolioCount });
  const run: Record<CompletenessAction, () => void> = {
    editProfile: onEditProfile,
    documents: onEditProfile,
    newService: onNewService,
    editService: onNewService,
    portfolio: onPortfolio,
  };
  const publicLink = (
    <Link to={providerPath(provider)} className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
      Ver meu perfil público <ExternalLink size={12} />
    </Link>
  );

  if (done === total) {
    return (
      <section aria-labelledby="checklist-title" className="mb-4 rounded-2xl p-4 border border-green-500/40 bg-green-500/5">
        <h3 id="checklist-title" className="font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" /> Perfil 100% completo
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1 mb-2">Todos os itens do seu perfil público estão preenchidos.</p>
        {publicLink}
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="checklist-title"
      className="mb-4 bg-[var(--bg-light)]/40 backdrop-blur-xl rounded-2xl p-4 border border-[var(--primary)]/50"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 id="checklist-title" className="font-semibold">Seu perfil está {percent}% completo</h3>
        <span className="text-xs text-[var(--text-muted)]">{done}/{total}</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-2">{nextStepMessage(items)}</p>
      <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden mb-3" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo">
        <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 size={16} className="text-green-500 shrink-0" aria-hidden />
            ) : (
              <Circle size={16} className="text-[var(--text-muted)] shrink-0" aria-hidden />
            )}
            <span className={`flex-1 ${item.done ? "text-[var(--text-muted)] line-through" : ""}`}>
              {item.label}
              <span className="sr-only">{item.done ? " (feito)" : " (pendente)"}</span>
              {!item.done && item.hint && <span className="block text-xs text-[var(--text-muted)] no-underline">{item.hint}</span>}
            </span>
            {!item.done && item.action && (
              <button onClick={run[item.action.to]} className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] hover:border-[var(--primary)] shrink-0">
                {item.action.text}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3">{publicLink}</div>
    </motion.section>
  );
}
