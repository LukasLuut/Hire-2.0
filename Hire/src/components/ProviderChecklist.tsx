import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProviderEntity } from "../interfaces/Entities";

/* --------------------------------------------------------------------------
 * ProviderChecklist — o que falta para o perfil do prestador ficar completo.
 * Cada item pendente tem um atalho; some quando tudo está feito.
 * -------------------------------------------------------------------------- */
interface Props {
  provider: ProviderEntity;
  servicesCount: number;
  servicesWithPhoto: number;
  reviewsCount: number;
  onEditProfile: () => void;
  onNewService: () => void;
}

export default function ProviderChecklist({ provider, servicesCount, servicesWithPhoto, reviewsCount, onEditProfile, onNewService }: Props) {
  const items: { label: string; done: boolean; action?: { text: string; run: () => void }; hint?: string }[] = [
    { label: "Foto ou logotipo no perfil", done: !!provider.profileImageUrl, action: { text: "Adicionar", run: onEditProfile } },
    { label: "Descrição do negócio", done: !!provider.description?.trim(), action: { text: "Escrever", run: onEditProfile } },
    { label: "Disponibilidade semanal", done: (provider.availabilities?.length ?? 0) > 0, action: { text: "Definir", run: onEditProfile } },
    { label: "Primeiro serviço publicado", done: servicesCount > 0, action: { text: "Publicar", run: onNewService } },
    { label: "Serviço com foto", done: servicesWithPhoto > 0, hint: "Edite um serviço e adicione imagens" },
    { label: "Primeira avaliação recebida", done: reviewsCount > 0, hint: "Chega depois do primeiro serviço concluído" },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  const percent = Math.round((done / items.length) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="checklist-title"
      className="mb-4 bg-[var(--bg-light)]/40 backdrop-blur-xl rounded-2xl p-4 border border-[var(--primary)]/50"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 id="checklist-title" className="font-semibold">Complete seu perfil</h3>
        <span className="text-xs text-[var(--text-muted)]">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden mb-3" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo">
        <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
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
              <button onClick={item.action.run} className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] hover:border-[var(--primary)] shrink-0">
                {item.action.text}
              </button>
            )}
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
