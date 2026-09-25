import { AppDataSource } from "../config/data-source";
import { User } from "../models/User";

/**
 * Contas suspensas ficam em memória para o authMiddleware não consultar o banco
 * a cada requisição. Carregado ao subir o servidor e atualizado pela administração.
 */
const blocked = new Set<number>();

export async function loadBlockedUsers() {
  const rows = await AppDataSource.getRepository(User).find({ where: { blocked: true }, select: { id: true } });
  blocked.clear();
  for (const r of rows) blocked.add(r.id);
}

export const isBlocked = (userId: number) => blocked.has(userId);

export function setBlocked(userId: number, value: boolean) {
  if (value) blocked.add(userId);
  else blocked.delete(userId);
}

/** E-mails de ADMIN_EMAILS (.env) — servem para criar o primeiro administrador. */
const bootstrapAdmins = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Administrador: papel "admin" no banco ou e-mail listado em ADMIN_EMAILS. */
export async function isAdmin(userId: number) {
  const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!user) return false;
  return user.role === "admin" || bootstrapAdmins().includes(user.email.toLowerCase());
}
