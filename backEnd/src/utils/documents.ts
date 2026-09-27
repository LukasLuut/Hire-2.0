/** Validação de CPF e CNPJ pelos dígitos verificadores (sem consulta externa). */

const digitsOf = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export function validCpf(value: unknown): boolean {
  const d = digitsOf(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function validCnpj(value: unknown): boolean {
  const d = digitsOf(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

/** "12345678000195" → "12.345.678/0001-95" */
export function formatCnpj(value: unknown): string {
  const d = digitsOf(value);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}

export const ACCOUNT_TYPES = ["cliente", "profissional", "empresa"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Porte aceito no cadastro de empresa (por enquanto só pequenas empresas) */
export const COMPANY_SIZES = ["MEI", "ME", "EPP"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];
