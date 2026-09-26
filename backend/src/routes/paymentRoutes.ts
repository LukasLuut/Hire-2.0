import { Router } from 'express'
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware } from '../middlewares/authMidlleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const paymentRouter = Router()
const controller = new PaymentController()

// O cliente paga pela contratação (POST /hires/:id/pay); aqui só a visão da administração.
// Pagamentos não são criados nem alterados à mão: saem do fluxo do pedido.
paymentRouter.use(authMiddleware, adminMiddleware);
paymentRouter.get('/', controller.overview);

export default paymentRouter
