import { BadgeCheck, Building2, GraduationCap, MailCheck } from "lucide-react";

/* --------------------------------------------------------------------------
 * VerificationBadges — selos do prestador, um por verificação REALMENTE
 * concluída. Preencher um campo (CNPJ, certificado) não gera selo: só a
 * confirmação do e-mail ou a análise da administração.
 * Telefone não é verificado pelo Hire (não há envio de SMS), então não aparece.
 * -------------------------------------------------------------------------- */
const chip = "px-3 py-1 rounded-full text-xs sm:text-sm border border-green-500/40 bg-green-500/10 text-green-500 inline-flex items-center gap-1 whitespace-nowrap";

export default function VerificationBadges({
  identity,
  email,
  company,
  credentials,
}: {
  identity?: boolean;
  email?: boolean;
  company?: boolean;
  credentials?: boolean;
}) {
  return (
    <>
      {identity && (
        <span className={chip} title="Documento de identidade conferido pela equipe do Hire">
          <BadgeCheck size={14} /> Identidade verificada
        </span>
      )}
      {company && (
        <span className={chip} title="Comprovante do CNPJ conferido pela equipe do Hire">
          <Building2 size={14} /> Empresa verificada
        </span>
      )}
      {credentials && (
        <span className={chip} title="Certificados profissionais conferidos pela equipe do Hire">
          <GraduationCap size={14} /> Certificação conferida
        </span>
      )}
      {email && (
        <span className={chip} title="E-mail da conta confirmado pelo link enviado no cadastro">
          <MailCheck size={14} /> E-mail confirmado
        </span>
      )}
    </>
  );
}
