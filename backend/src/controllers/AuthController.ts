import { Request, Response } from 'express'
import { inviteService } from '../services/InviteService'
import { UserService } from '../services/UserService'
import { generateToken } from '../utils/jwt' // Importa a função que gera o JWT
import { accountService } from '../services/AccountService'

const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

const service = new UserService()

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
      const user = await service.findByEmail(email)
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado' })
  
      const valid = await user.validatePassword(password)
      if (!valid) return res.status(401).json({ message: 'Senha inválida' })
      if (user.blocked) return res.status(403).json({ message: 'Conta suspensa pela administração' + (user.blockedReason ? `: ${user.blockedReason}` : '') })
  
      const safe: any = { ...user }
      delete safe.password // Remove a senha antes de enviar os dados ao cliente
  
      const token = generateToken({ id: user.id, name: user.name, email: user.email, about: user.about })
      
      res.json({ user: safe, token })
    } catch (e: any) {
      res.status(400).json({ messages: e.message })
    }
  }
  
}
