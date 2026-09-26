import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMidlleware'
import { addClient, createTicket, redeemTicket } from '../utils/events'
import { isBlocked } from '../utils/access'

// Tempo real: POST /events/ticket (com token) → GET /events?ticket=... (EventSource)
const eventRouter = Router()

eventRouter.post('/ticket', authMiddleware, (req, res) => {
  res.json({ ticket: createTicket(Number((req as any).user.id)) })
})

eventRouter.get('/', (req, res) => {
  const userId = redeemTicket(String(req.query.ticket ?? ''))
  if (!userId || isBlocked(userId)) return res.status(401).json({ message: 'Ticket inválido ou expirado' })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: não segurar os eventos em buffer
  })
  res.write('retry: 5000\n\n')
  const remove = addClient(userId, res)
  req.on('close', remove)
})

export default eventRouter
