import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { walletService } from '../services/WalletService'

// Carteira do prestador: saldo, extrato e saques (simulados)
const walletRouter = Router()
const me = (req: Request) => Number((req as any).user.id)
const fail = (res: Response, e: any) => res.status(e?.status ?? 400).json({ message: e?.message ?? 'Erro inesperado' })

walletRouter.use(authMiddleware)
walletRouter.get('/', async (req, res) => {
  try { res.json(await walletService.overview(me(req))) } catch (e) { fail(res, e) }
})
walletRouter.post('/withdrawals', async (req, res) => {
  try { res.status(201).json(await walletService.requestWithdrawal(me(req), req.body ?? {})) } catch (e) { fail(res, e) }
})
walletRouter.post('/withdrawals/:id/cancel', async (req, res) => {
  try { res.json(await walletService.cancelWithdrawal(me(req), Number(req.params.id))) } catch (e) { fail(res, e) }
})

export default walletRouter
