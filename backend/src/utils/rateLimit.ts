import type { Request, Response, NextFunction } from "express";

/**
 * Limite simples por IP em memória (janela fixa). O IP só vive na memória do
 * processo durante a janela — não é gravado em banco nem em log.
 * Suficiente para uma instância; com várias, trocar por um armazenamento compartilhado.
 */
/**
 * Trava por tentativas que falharam (ex.: senha errada para um e-mail, a partir de um IP).
 * Acertar zera a contagem; só falhas contam, então login de quem acerta nunca trava.
 */
export function failureLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const fails = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of fails) if (v.reset <= now) fails.delete(k);
  }, windowMs).unref();
  return {
    /** segundos até liberar, ou 0 se pode tentar */
    retryAfter(key: string) {
      const e = fails.get(key);
      return e && e.reset > Date.now() && e.count >= max ? Math.ceil((e.reset - Date.now()) / 1000) : 0;
    },
    fail(key: string) {
      const now = Date.now();
      const e = fails.get(key);
      if (!e || e.reset <= now) fails.set(key, { count: 1, reset: now + windowMs });
      else e.count++;
    },
    reset(key: string) {
      fails.delete(key);
    },
  };
}

export function rateLimit({ windowMs, max, message = "Muitas requisições. Tente de novo em instantes." }: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ message });
    }
    next();
  };
}
