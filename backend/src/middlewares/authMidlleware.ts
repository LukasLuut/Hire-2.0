import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { isBlocked } from '../utils/access'

// Middleware para proteger rotas que exigem autenticação
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Pega o header de autorização da requisição ("Bearer <token>")
  const authHeader = req.headers.authorization

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido' })
  }

  // Verifica o token; inválido ou expirado → 401
  const decoded = verifyToken(authHeader.split(' ')[1])
  if (!decoded) {
    return res.status(401).json({ message: 'Token inválido' })
  }

  if (isBlocked(Number((decoded as any).id))) {
    return res.status(403).json({ message: 'Conta suspensa pela administração' })
  }

  // req.user terá id, nome e e-mail do usuário logado
  (req as any).user = decoded
  next()
}
