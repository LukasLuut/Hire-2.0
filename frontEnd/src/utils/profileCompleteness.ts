import type { ProviderEntity } from "../interfaces/Entities";

/**
 * Completude do perfil do prestador: só itens que dependem dele e que aparecem
 * para o cliente no perfil público. Avaliações ficam de fora (dependem do cliente).
 * Cada item diz o que falta e qual ação resolve; o percentual é itens feitos / total.
 */
export type CompletenessAction = "editProfile" | "newService" | "editService" | "portfolio" | "documents";

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  action?: { text: string; to: CompletenessAction };
  hint?: string;
}

export function profileCompleteness(
  provider: ProviderEntity,
  counts: { services: number; servicesWithPhoto: number; portfolio: number }
) {
  const v = provider.verificationStatus;
  const items: CompletenessItem[] = [
    { key: "photo", label: "Foto ou logotipo", done: !!provider.profileImageUrl, action: { text: "Adicionar", to: "editProfile" } },
    { key: "category", label: "Nome e categoria", done: !!(provider.companyName || provider.professionalName) && !!provider.category, action: { text: "Definir", to: "editProfile" } },
    { key: "description", label: "Descrição do negócio", done: !!provider.description?.trim(), action: { text: "Escrever", to: "editProfile" } },
    { key: "area", label: "Cidade e área de atendimento", done: !!provider.baseCity || !!provider.attendsOnline, action: { text: "Informar", to: "editProfile" } },
    { key: "hours", label: "Horários de atendimento", done: (provider.availabilities?.length ?? 0) > 0, action: { text: "Definir", to: "editProfile" } },
    { key: "service", label: "Serviço publicado", done: counts.services > 0, action: { text: "Publicar", to: "newService" } },
    { key: "servicePhoto", label: "Serviço com foto", done: counts.servicesWithPhoto > 0, hint: "Edite um serviço e adicione imagens" },
    { key: "portfolio", label: "Portfólio com trabalhos", done: counts.portfolio > 0, action: { text: "Adicionar", to: "portfolio" } },
    {
      key: "identity",
      label: v === "pending" ? "Identidade verificada (em análise)" : "Identidade verificada",
      done: v === "verified" || v === "pending",
      action: { text: "Enviar", to: "documents" },
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

/** Frase do painel sobre o próximo passo — descreve, não promete resultado */
export function nextStepMessage(items: CompletenessItem[]) {
  const next = items.find((i) => !i.done);
  if (!next) return "Seu perfil público está completo.";
  const messages: Record<string, string> = {
    photo: "Adicione uma foto ou logotipo para os clientes reconhecerem seu negócio.",
    category: "Defina sua categoria para aparecer nas buscas certas.",
    description: "Escreva uma descrição contando o que você faz.",
    area: "Informe sua cidade e o raio de atendimento.",
    hours: "Defina seus horários de atendimento.",
    service: "Publique seu primeiro serviço para receber pedidos.",
    servicePhoto: "Adicione fotos aos seus serviços.",
    portfolio: "Complete seu portfólio para melhorar sua apresentação profissional.",
    identity: "Envie seus documentos para ganhar o selo de identidade verificada.",
  };
  return messages[next.key] ?? "Complete os itens pendentes do seu perfil.";
}
