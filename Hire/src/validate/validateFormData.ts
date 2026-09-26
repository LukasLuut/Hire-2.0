import type { ProviderForm } from "../components/ProviderRegistration/ProviderRegistration/helpers/types-and-helpers";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valida a etapa atual do cadastro de prestador. Retorna a mensagem do primeiro problema, ou null. */
export const validateFormData = (data: ProviderForm, step: number): string | null => {
  if (step == 0) {
    if (!data.name || data.name.trim() == "") return "Informe seu nome profissional ou o nome da empresa.";
    if (data.cnpj && data.cnpj.replace(/\D/g, "").length !== 14) return "O CNPJ deve ter 14 dígitos (ou deixe em branco).";
    if (!data.professionalEmail) return "Informe um e-mail profissional.";
    if (!isValidEmail(data.professionalEmail)) return "Informe um e-mail válido, como nome@exemplo.com.";
    if (!data.professionalPhone || data.professionalPhone.replace(/\D/g, "").length !== 11)
      return "Informe um telefone com DDD, como (51) 99999-9999.";
  }

  if (step >= 1) {
    if (!data.category) return "Escolha a categoria principal dos seus serviços.";
  }

  return null;
};
