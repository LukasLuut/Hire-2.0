/**
 * O prestador pode ser encontrado e receber pedidos?
 * Fica fora do ar quando a conta está suspensa pela administração (User.blocked)
 * ou quando a conta profissional foi desativada pelo próprio prestador.
 * (Fechado / fechado até: ver utils/openStatus.ts — o perfil continua visível.)
 */
export function providerOffline(p: { deactivatedAt?: Date | null; user?: { blocked?: boolean | null } | null } | null | undefined) {
  return !p || !!p.deactivatedAt || !!p.user?.blocked;
}

export const OFFLINE_MESSAGE = "Este profissional não está mais disponível no Hire";
