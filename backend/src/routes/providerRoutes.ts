import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { ProviderController } from '../controllers/ProviderController'
import { upload, privateUpload, imageUpload } from '../middlewares/uploadMiddleware'
import { portfolioService } from '../services/PortfolioService'
import QRCode from 'qrcode'
import { ProviderService } from '../services/ProviderService'
import { frontendUrl } from '../services/MailService'
const providerService = new ProviderService()
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
providerRouter.post('/me/verification', authMiddleware, privateUpload.fields([{ name: 'idDocument', maxCount: 1 }, { name: 'certifications', maxCount: 4 }, { name: 'companyDocument', maxCount: 1 }]), async (req, res) => {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>
  try { res.status(201).json(await verificationService.submit(me(req), files.idDocument?.[0], files.certifications ?? [], files.companyDocument?.[0])) } catch (e) { fail(res, e) }
})
providerRouter.get('/verification/:id/files/:name', authMiddleware, async (req, res) => {
  try {
    const file = await verificationService.filePath(Number(req.params.id), String(req.params.name), me(req))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(file)
  } catch (e) { fail(res, e) }
})

// Conta profissional: desativar (vira só cliente) e reativar
providerRouter.post('/me/deactivate', authMiddleware, async (req, res) => {
  try { res.json(await providerService.deactivate(me(req))) } catch (e) { fail(res, e) }
})
providerRouter.post('/me/reactivate', authMiddleware, async (req, res) => {
  try { res.json(await providerService.reactivate(me(req))) } catch (e) { fail(res, e) }
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

// QR Code do perfil público (aponta para /prestador/<slug>?src=qr); PNG para baixar/imprimir ou SVG
providerRouter.get('/:id/qr', async (req, res) => {
  try {
    const id = await providerService.resolveId(String(req.params.id))
    const slug = await providerService.slugOf(id)
    const url = `${frontendUrl()}/prestador/${slug}?src=qr`
    const svg = req.query.format === 'svg'
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="qr-${slug}.${svg ? 'svg' : 'png'}"`)
    if (svg) {
      res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }))
    } else {
      res.type('png').send(await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2, errorCorrectionLevel: 'M' }))
    }
  } catch (e: any) {
    res.status(404).json({ message: 'Prestador não encontrado' })
  }
})

providerRouter.get('/all', controller.list.bind(controller));
providerRouter.get('/:id/public', controller.getPublic.bind(controller));

export default providerRouter;

