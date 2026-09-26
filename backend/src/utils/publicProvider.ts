import type { ServiceProvider } from "../models/ServiceProvider";

/**
 * Dados de um prestador que podem sair em respostas públicas (sem login):
 * perfil, vitrine, página de serviço e listas.
 *
 * Ficam de fora: coordenadas exatas (a distância é calculada no servidor),
 * CNPJ, link privado de atendimento online, preferências internas
 * (avisos por WhatsApp/e-mail) e o contato profissional — este só aparece
 * quando o prestador liga "mostrar contato no perfil" (showContact).
 */
export function toPublicProvider(p: (ServiceProvider & Record<string, any>) | null | undefined) {
  if (!p) return p ?? null;
  const out: Record<string, unknown> = {
    id: p.id,
    slug: p.slug ?? null,
    professionalName: p.professionalName,
    companyName: p.companyName,
    description: p.description,
    profileImageUrl: p.profileImageUrl ?? null,
    status: p.status,
    attendsPresent: p.attendsPresent,
    attendsOnline: p.attendsOnline,
    personalizedProposals: p.personalizedProposals,
    publicReviews: p.publicReviews,
    pricesOnPage: p.pricesOnPage,
    approximateLocation: p.approximateLocation,
    baseCity: p.baseCity ?? null,
    baseState: p.baseState ?? null,
    serviceRadiusKm: p.serviceRadiusKm ?? null,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt ?? null,
    createdAt: p.createdAt ?? null,
    showContact: !!p.showContact,
  };
  if (p.showContact) {
    out.professionalEmail = p.professionalEmail;
    out.professionalPhone = p.professionalPhone;
  }
  // campos calculados ou relações, quando vierem carregados
  for (const key of ["rating", "completedHires", "level", "lateCancellations", "category", "subcategories", "links", "availabilities", "emailVerified"]) {
    if (p[key] !== undefined) out[key] = p[key];
  }
  if (p.user) out.user = { id: p.user.id, name: p.user.name };
  return out;
}
