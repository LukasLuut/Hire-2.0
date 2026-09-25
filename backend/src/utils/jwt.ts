import jwt from 'jsonwebtoken'

interface Payload {
  id: number
  name: string
  email: string
  about: string
}

/** Segredo lido do .env; sem ele o servidor não deve assinar nem aceitar tokens. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET ausente ou curto demais (mínimo 32 caracteres) no backend/.env")
  }
  return secret
}

export const generateToken = (payload: Payload) => {
  return jwt.sign(payload, jwtSecret(), {
    expiresIn: Number(process.env.JWT_EXPIRES_IN) || 86400
  })
}

export const verifyToken = (token: string) => {
    try {
        // valida o token e devolve o payload (id, nome, e-mail); inválido ou expirado → null
        return jwt.verify(token, jwtSecret())
    }
    catch {
        return null;
    }
}
