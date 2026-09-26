import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { adminMiddleware } from '../middlewares/adminMiddleware'
import { adminService } from '../services/AdminService'
import { reportService } from '../services/ReportService'
import { verificationService } from '../services/VerificationService'
import { regionalOverview } from '../seo/cityPages'

// Painel de administração: todas as rotas exigem login e papel de administrador
const adminRouter = Router()
adminRouter.use(authMiddleware, adminMiddleware)

const me = (req: Request) => Number((req as any).user.id)
const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    res.json(await fn(req))
  } catch (e: any) {
    res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })
  }
}

adminRouter.get('/overview', handle(() => adminService.overview()))
adminRouter.get('/users', handle((req) => adminService.listUsers(String(req.query.q ?? ''))))
adminRouter.post('/users/:id/block', handle((req) => adminService.setBlocked(Number(req.params.id), req.body?.blocked === true, req.body?.reason, me(req))))
adminRouter.put('/users/:id/role', handle((req) => adminService.setRole(Number(req.params.id), req.body?.role, me(req))))
adminRouter.get('/services', handle((req) => adminService.listServices(String(req.query.q ?? ''))))
adminRouter.post('/services/:id/active', handle((req) => adminService.setServiceActive(Number(req.params.id), req.body?.active === true, req.body?.reason)))
adminRouter.get('/reports', handle((req) => reportService.list(req.query.status ? String(req.query.status) : undefined)))
adminRouter.post('/reports/:id/resolve', handle((req) => reportService.resolve(Number(req.params.id), req.body?.status, req.body?.resolution, me(req))))
adminRouter.get('/verifications', handle((req) => verificationService.list(req.query.status ? String(req.query.status) : undefined)))
adminRouter.post('/verifications/:providerId', handle((req) => verificationService.decide(Number(req.params.providerId), req.body?.approve === true, req.body?.note, { company: req.body?.company, credentials: req.body?.credentials })))
adminRouter.get('/regions', handle(() => regionalOverview()))
adminRouter.get('/hires', handle((req) => adminService.listHires(req.query.status ? String(req.query.status) : undefined)))

export default adminRouter
