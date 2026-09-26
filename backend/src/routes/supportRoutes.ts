import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { rateLimit } from '../utils/rateLimit'
import { supportService } from '../services/SupportService'

const supportRouter = Router()
const me = (req: Request) => Number((req as any).user.id)
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

supportRouter.use(authMiddleware)

// Abrir chamado (limite por IP para evitar spam) e acompanhar os próprios
supportRouter.post('/', rateLimit({ windowMs: 60 * 60_000, max: 20 }), async (req, res) => {
  try { res.status(201).json(await supportService.create(me(req), req.body ?? {})) } catch (e) { fail(res, e) }
})
supportRouter.get('/me', async (req, res) => {
  try { res.json(await supportService.mine(me(req))) } catch (e) { fail(res, e) }
})

export default supportRouter
