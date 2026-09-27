import { Request, Response } from 'express'
import { failureLimiter } from '../utils/rateLimit'
import { inviteService } from '../services/InviteService'
import { UserService } from '../services/UserService'
import { generateToken } from '../utils/jwt' // Importa a função que gera o JWT
import { accountService } from '../services/AccountService'

const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

const service = new UserService()

// 5 senhas erradas para o mesmo e-mail (a partir do mesmo IP) travam por 15 minutos;
// 100 erros de um IP em qualquer e-mail também (tentativa em massa)
const loginGuard = failureLimiter({ windowMs: 15 * 60_000, max: 5 })
const ipGuard = failureLimiter({ windowMs: 15 * 60_000, max: 100 })
// mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta
const INVALID_LOGIN = 'E-mail ou senha incorretos'

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const acceptedAt: Date = new Date();
      const body = {...req.body, acceptedAt}
      const user = await service.create(body)
      // cadastro vindo de convite: guarda a origem (código inválido é ignorado)
      await inviteService.attachOnSignup(user.id, req.body?.invite).catch(() => null)
      // link de confirmação por e-mail (falha no envio não impede o cadastro)
      await accountService.sendVerification(user.id).catch(() => null)
      res.status(201).json(user)
    } catch (e: any) {
      res.status(400).json({ message: e.message })
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      res.json(await accountService.verify(req.body?.token))
    } catch (e: any) {
      fail(res, e)
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      res.json(await accountService.sendVerification((req as any).user.id))
    } catch (e: any) {
      fail(res, e)
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      res.json(await accountService.forgot(req.body?.email))
    } catch (e: any) {
      fail(res, e)
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      res.json(await accountService.reset(req.body?.token, req.body?.password))
    } catch (e: any) {
      fail(res, e)
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body
      const ip = req.ip ?? 'unknown'
      const key = `${ip}|${String(email ?? '').trim().toLowerCase()}`
      const wait = Math.max(loginGuard.retryAfter(key), ipGuard.retryAfter(ip))
      if (wait) {
        res.setHeader('Retry-After', wait)
        return res.status(429).json({ message: `Muitas tentativas. Tente de novo em ${Math.ceil(wait / 60)} min ou recupere a senha.` })
      }
      const user = typeof email === 'string' && email ? await service.findByEmail(email) : null
      const valid = !!user && typeof password === 'string' && await user.validatePassword(password)
      if (!user || !valid) {
        loginGuard.fail(key)
        ipGuard.fail(ip)
        return res.status(401).json({ message: INVALID_LOGIN })
      }
      loginGuard.reset(key)
      if (user.blocked) return res.status(403).json({ message: 'Conta suspensa pela administração' + (user.blockedReason ? `: ${user.blockedReason}` : '') })

      const safe: any = { ...user }
      delete safe.password // Remove a senha antes de enviar os dados ao cliente

      const token = generateToken({ id: user.id, name: user.name, email: user.email, about: user.about })

      res.json({ user: safe, token })
    } catch (e: any) {
      res.status(400).json({ message: e.message })
    }
  }

}
