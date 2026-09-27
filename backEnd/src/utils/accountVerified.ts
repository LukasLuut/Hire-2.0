import { VerificationStatus, type ServiceProvider } from "../models/ServiceProvider";

/**
 * Selo "Conta verificada": só quando o cadastro está completo E todas as validações passaram.
 * - cadastro: foto, nome, categoria, descrição, telefone e e-mail profissionais, cidade (ou atendimento online);
 *   empresa também precisa do CNPJ;
 * - validações: e-mail da conta confirmado, identidade conferida pela administração e,
 *   para empresa, o comprovante do CNPJ conferido.
 * Certificados profissionais são opcionais e não entram na regra.
 * Precisa do prestador com `user` e `category` carregados; sem eles, não há selo.
 */
export function accountVerified(p: (ServiceProvider & Record<string, any>) | null | undefined): boolean {
  if (!p || p.deactivatedAt || p.user?.blocked) return false;
  const emailOk = !!(p.emailVerified ?? p.user?.emailVerified);
  const identityOk = p.verificationStatus === VerificationStatus.VERIFIED && !!p.verifiedAt;
  const company = p.businessType === "empresa";
  const companyOk = !company || (!!p.cnpj && !!p.companyVerifiedAt);
  const has = (v: unknown) => typeof v === "string" ? v.trim().length > 0 : !!v;
  const registrationOk =
    has(p.profileImageUrl) &&
    has(p.companyName || p.professionalName) &&
    !!p.category &&
    has(p.description) &&
    has(p.professionalPhone) &&
    has(p.professionalEmail) &&
    (has(p.baseCity) || !!p.attendsOnline);
  return emailOk && identityOk && companyOk && registrationOk;
}
