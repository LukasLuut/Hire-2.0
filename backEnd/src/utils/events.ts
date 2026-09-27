import crypto from "crypto";
import type { Response } from "express";

/*
 * Eventos em tempo real (Server-Sent Events).
 * Cada usuário pode ter algumas abas abertas; cada aba recebe os eventos dele.
 * O EventSource do navegador não envia cabeçalhos, então a conexão usa um
 * ticket de uso único (60 s) obtido com o token normal — o JWT não vai na URL.
 */
export type LiveEvent = { type: "notification" } | { type: "conversation"; id: number };

const MAX_PER_USER = 6;
const TICKET_MS = 60_000;
const clients = new Map<number, Set<Response>>();
const tickets = new Map<string, { userId: number; exp: number }>();

export function createTicket(userId: number) {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
  const ticket = crypto.randomBytes(24).toString("hex");
  tickets.set(ticket, { userId, exp: now + TICKET_MS });
  return ticket;
}

/** Troca o ticket pelo id do usuário (uma vez só) */
export function redeemTicket(ticket: string) {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.exp < Date.now()) return null;
  return entry.userId;
}

export function addClient(userId: number, res: Response) {
  let set = clients.get(userId);
  if (!set) clients.set(userId, (set = new Set()));
  // abas demais: fecha a mais antiga
  if (set.size >= MAX_PER_USER) {
    const oldest = set.values().next().value as Response;
    set.delete(oldest);
    oldest.end();
  }
  set.add(res);
  return () => {
    set!.delete(res);
    if (!set!.size) clients.delete(userId);
  };
}

/** Envia o evento para todas as abas dos usuários */
export function publish(userIds: (number | null | undefined)[], event: LiveEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const id of new Set(userIds)) {
    if (!id) continue;
    for (const res of clients.get(id) ?? []) res.write(data);
  }
}

/** Comentário periódico para proxies não derrubarem conexões paradas */
setInterval(() => {
  for (const set of clients.values()) for (const res of set) res.write(": ping\n\n");
}, 25_000).unref();

export const connectedUsers = () => clients.size;
