/* --------------------------------------------------------------------------
 * Etapas de uma contratação, derivadas dos status reais do backend:
 *   status_provider: PENDENTE → EM ANDAMENTO → CONCLUIDO (prestador)
 *   status:          PENDENTE → CONCLUIDO                (confirmação do cliente)
 * -------------------------------------------------------------------------- */
export type HireStage = "requested" | "in_progress" | "delivered" | "done" | "cancelled";

export interface HireLike {
  status?: string;
  status_provider?: string;
}

export function getHireStage(hire: HireLike): HireStage {
  if (hire.status === "CANCELADO" || hire.status_provider === "CANCELADO") return "cancelled";
  if (hire.status === "CONCLUIDO") return "done";
  if (hire.status_provider === "CONCLUIDO") return "delivered";
  if (hire.status_provider === "EM ANDAMENTO") return "in_progress";
  return "requested";
}

export const HIRE_STEPS: { id: Exclude<HireStage, "cancelled">; label: string }[] = [
  { id: "requested", label: "Solicitado" },
  { id: "in_progress", label: "Em andamento" },
  { id: "delivered", label: "Entregue pelo prestador" },
  { id: "done", label: "Concluído" },
];

export const HIRE_STAGE_LABEL: Record<HireStage, string> = {
  requested: "Aguardando início",
  in_progress: "Em andamento",
  delivered: "Aguardando sua confirmação",
  done: "Concluído",
  cancelled: "Cancelado",
};

/** Rótulo do status visto pelo prestador (o "delivered" significa outra coisa para ele). */
export const HIRE_STAGE_LABEL_PROVIDER: Record<HireStage, string> = {
  requested: "Novo pedido",
  in_progress: "Em andamento",
  delivered: "Aguardando confirmação do cliente",
  done: "Concluído",
  cancelled: "Cancelado",
};

export function stepIndex(stage: HireStage): number {
  const i = HIRE_STEPS.findIndex((s) => s.id === stage);
  return i === -1 ? 0 : i;
}

export function isOpenHire(hire: HireLike) {
  const stage = getHireStage(hire);
  return stage !== "done" && stage !== "cancelled";
}
