import { Request, Response, NextFunction } from 'express'
import { isAdmin } from '../utils/access'

/**
 * Só administradores: papel "admin" no usuário ou e-mail listado em ADMIN_EMAILS no .env
 * (separados por vírgula; serve para criar o primeiro administrador). Use depois do authMiddleware.
 */
export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const id = Number((req as any).user?.id)
  if (!id || !(await isAdmin(id).catch(() => false))) {
    return res.status(403).json({ message: 'Acesso restrito à administração' })
  }
  next()
}
