import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { ProviderController } from '../controllers/ProviderController'
import { upload, privateUpload, imageUpload } from '../middlewares/uploadMiddleware'
import { portfolioService } from '../services/PortfolioService'
import { verificationService } from '../services/VerificationService'
import { Request, Response } from 'express'

const providerRouter = Router()
const controller = new ProviderController()

providerRouter.post('/', authMiddleware, upload.single("image"), controller.create.bind(controller))
providerRouter.get('/', authMiddleware, controller.getById.bind(controller))
providerRouter.put('/', authMiddleware, upload.single("image"), controller.update.bind(controller))
providerRouter.delete('/', authMiddleware, controller.delete.bind(controller))

providerRouter.get('/services', authMiddleware, controller.getServices.bind(controller))

// Verificação do prestador (documentos privados)
const me = (req: Request) => Number((req as any).user.id)
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })
providerRouter.get('/me/verification', authMiddleware, async (req, res) => {
  try { res.json(await verificationService.mine(me(req))) } catch (e) { fail(res, e) }
})
providerRouter.post('/me/verification', authMiddleware, privateUpload.fields([{ name: 'idDocument', maxCount: 1 }, { name: 'certifications', maxCount: 4 }]), async (req, res) => {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>
  try { res.status(201).json(await verificationService.submit(me(req), files.idDocument?.[0], files.certifications ?? [])) } catch (e) { fail(res, e) }
})
providerRouter.get('/verification/:id/files/:name', authMiddleware, async (req, res) => {
  try {
    const file = await verificationService.filePath(Number(req.params.id), String(req.params.name), me(req))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(file)
  } catch (e) { fail(res, e) }
})

// Portfólio do próprio prestador (o público vem junto do perfil)
providerRouter.get('/me/portfolio', authMiddleware, async (req, res) => {
  try { res.json(await portfolioService.mine(me(req))) } catch (e) { fail(res, e) }
})
providerRouter.post('/me/portfolio', authMiddleware, imageUpload.single('image'), async (req, res) => {
  try { res.status(201).json(await portfolioService.create(me(req), req.body ?? {}, req.file)) } catch (e) { fail(res, e) }
})
providerRouter.put('/me/portfolio/order', authMiddleware, async (req, res) => {
  try { res.json(await portfolioService.reorder(me(req), req.body?.ids)) } catch (e) { fail(res, e) }
})
providerRouter.put('/me/portfolio/:itemId', authMiddleware, imageUpload.single('image'), async (req, res) => {
  try { res.json(await portfolioService.update(me(req), Number(req.params.itemId), req.body ?? {}, req.file)) } catch (e) { fail(res, e) }
})
providerRouter.delete('/me/portfolio/:itemId', authMiddleware, async (req, res) => {
  try { res.json(await portfolioService.remove(me(req), Number(req.params.itemId))) } catch (e) { fail(res, e) }
})

providerRouter.get('/all', controller.list.bind(controller));
providerRouter.get('/:id/public', controller.getPublic.bind(controller));

export default providerRouter;

