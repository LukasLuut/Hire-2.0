import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { analyticsService } from '../services/AnalyticsService'
import { rateLimit } from '../utils/rateLimit'
import { AppDataSource } from '../config/data-source'
import { ServiceProvider } from '../models/ServiceProvider'

// Métricas de aquisição: eventos públicos (limitados por IP) e totais do próprio prestador
const analyticsRouter = Router()
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

analyticsRouter.post('/event', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  try {
    res.json(await analyticsService.track(req.body ?? {}))
  } catch (e) {
    fail(res, e)
  }
})

analyticsRouter.get('/me', authMiddleware, async (req: Request, res) => {
  try {
    const provider = await AppDataSource.getRepository(ServiceProvider).findOne({ where: { user: { id: Number((req as any).user.id) } }, select: { id: true } })
    if (!provider) return res.status(404).json({ message: 'Cadastre sua empresa primeiro' })
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    res.json(await analyticsService.forProvider(provider.id, days))
  } catch (e) {
    fail(res, e)
  }
})

export default analyticsRouter
