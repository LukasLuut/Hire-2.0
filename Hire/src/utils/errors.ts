/** Mensagem legível de um erro desconhecido (ex.: dentro de catch), com texto padrão. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
