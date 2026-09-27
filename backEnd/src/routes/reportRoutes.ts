import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { privateUpload } from '../middlewares/uploadMiddleware'
import { reportService } from '../services/ReportService'

// Relatos de problema: exigem login; anexos ficam fora da pasta pública
const reportRouter = Router()
reportRouter.use(authMiddleware)

const me = (req: Request) => Number((req as any).user.id)
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

reportRouter.post('/', privateUpload.array('files', 4), async (req, res) => {
  try {
    res.status(201).json(await reportService.create(me(req), req.body, (req.files as Express.Multer.File[] | undefined) ?? []))
  } catch (e) {
    fail(res, e)
  }
})

reportRouter.get('/mine', async (req, res) => {
  try {
    res.json(await reportService.mine(me(req)))
  } catch (e) {
    fail(res, e)
  }
})

reportRouter.get('/:id/files/:name', async (req, res) => {
  try {
    const file = await reportService.filePath(Number(req.params.id), String(req.params.name), me(req))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(file)
  } catch (e) {
    fail(res, e)
  }
})

export default reportRouter
