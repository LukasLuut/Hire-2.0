// apiClient.ts
export const LOCAL_PORT: string = import.meta.env.VITE_API_URL ?? `http://localhost:8080`;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    response = await fetch(`${LOCAL_PORT}${endpoint}`, { ...options, headers });
  } catch {
    // fetch só rejeita quando não há resposta (servidor fora do ar, sem internet)
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }

  let body: unknown = null;

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    body = await response.json();
  }

  if (!response.ok) {
    // Token expirado ou inválido: encerra a sessão e volta para o login
    if (response.status === 401 && headers.Authorization) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.assign("/auth?expirada=1");
      }
      throw new Error("Sua sessão expirou. Entre novamente.");
    }

    let message = "Algo deu errado. Tente novamente.";

    if (Array.isArray(body)) {
      // Erros de validação (class-validator): [{ campo: "mensagem" }]
      message = (Object.values(body[0] ?? {})[0] as string) ?? message;
    } else if (typeof body === "object" && body !== null) {
      const b = body as { message?: string; messages?: string; error?: string };
      message = b.message || b.messages || b.error || message;
    }

    // status HTTP junto (ex.: 410 = perfil desativado, 404 = não existe)
    const err = new Error(message) as Error & { status?: number; reason?: string };
    err.status = response.status;
    if (typeof body === "object" && body !== null && "reason" in body) err.reason = String((body as { reason?: unknown }).reason);
    throw err;
  }

  return body as T;
}
