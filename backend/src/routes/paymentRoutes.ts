import { Router } from 'express'
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware } from '../middlewares/authMidlleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const paymentRouter = Router()
const controller = new PaymentController()

// Pagamentos ainda não fazem parte do fluxo: acesso só pela administração
paymentRouter.use(authMiddleware, adminMiddleware);

paymentRouter.post('/', controller.create.bind(controller));
paymentRouter.get('/', controller.list.bind(controller));
paymentRouter.put('/:id', controller.update.bind(controller));
paymentRouter.delete('/:id', controller.delete.bind(controller));
paymentRouter.get('/:id', controller.getById.bind(controller));

export default paymentRouter
