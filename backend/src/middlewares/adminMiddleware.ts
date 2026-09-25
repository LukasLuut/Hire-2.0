import { Request, Response, NextFunction } from 'express'

/**
 * Só administradores (e-mails listados em ADMIN_EMAILS no .env, separados por vírgula).
 * Use depois do authMiddleware. Sem ADMIN_EMAILS, ninguém é administrador.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const email = String((req as any).user?.email ?? '').toLowerCase()
  if (!email || !admins.includes(email)) {
    return res.status(403).json({ message: 'Acesso restrito à administração' })
  }
  next()
}
