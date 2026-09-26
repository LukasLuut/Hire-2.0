import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Log estruturado: uma linha JSON por evento (fácil de filtrar e de mandar para um coletor).
 * Nunca registra corpo de requisição, query string, senha, token ou documento.
 * LOG_LEVEL=debug|info|warn|error (padrão info); LOG_FORMAT=pretty deixa legível no terminal.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = (): Level => (["debug", "info", "warn", "error"].includes(String(process.env.LOG_LEVEL)) ? (process.env.LOG_LEVEL as Level) : "info");

function write(level: Level, msg: string, ctx: Record<string, unknown> = {}) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const entry = { ts: new Date().toISOString(), level, msg, ...ctx };
  const line = process.env.LOG_FORMAT === "pretty"
    ? `${entry.ts} ${level.toUpperCase().padEnd(5)} ${msg} ${Object.keys(ctx).length ? JSON.stringify(ctx) : ""}`
    : JSON.stringify(entry);
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};

/** Resumo seguro de um erro (sem dados da requisição) */
export const errorInfo = (e: any) => ({ error: e?.message ?? String(e), code: e?.code, stack: process.env.NODE_ENV === "production" ? undefined : e?.stack?.split("\n").slice(0, 4).join(" | ") });

/**
 * Registra cada requisição ao terminar: método, caminho (sem query), status, duração e quem fez.
 * Devolve o id no cabeçalho X-Request-Id para cruzar com o log.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  const incoming = String(req.headers["x-request-id"] ?? "");
  const id = /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader("X-Request-Id", id);
  res.on("finish", () => {
    // caminho completo sem query (a query pode ter token/assinatura); os roteadores reescrevem req.path
    const path = req.originalUrl.split("?")[0];
    // estáticos e o canal de eventos ficam de fora (muito volume, pouco valor)
    if (path.startsWith("/uploads/") || path.startsWith("/assets/") || path === "/events") return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const status = res.statusCode;
    write(status >= 500 ? "error" : status >= 400 ? "warn" : "info", "http", {
      requestId: id,
      method: req.method,
      path: path.replace(/\/files\/c\/[^/]+/, "/files/c/:name"),
      status,
      ms: Math.round(ms * 10) / 10,
      userId: (req as any).user?.id ?? undefined,
    });
  });
  next();
}
