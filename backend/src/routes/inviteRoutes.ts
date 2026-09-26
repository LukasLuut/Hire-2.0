import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { inviteService } from '../services/InviteService'
import { rateLimit } from '../utils/rateLimit'

// Convites: criar e acompanhar (com login); ver um convite (público)
const inviteRouter = Router()
const me = (req: Request) => Number((req as any).user.id)
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

inviteRouter.post('/', authMiddleware, rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  try { res.status(201).json(await inviteService.create(me(req), req.body ?? {})) } catch (e) { fail(res, e) }
})
inviteRouter.get('/me', authMiddleware, async (req, res) => {
  try { res.json(await inviteService.mine(me(req))) } catch (e) { fail(res, e) }
})
inviteRouter.get('/:code', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  try { res.json(await inviteService.publicInfo(String(req.params.code))) } catch (e) { fail(res, e) }
})

export default inviteRouter
