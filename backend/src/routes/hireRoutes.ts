import { Router } from 'express'
import { HireController } from '../controllers/HireController';
import { authMiddleware } from '../middlewares/authMidlleware';

const hireRouter = Router()
const controller = new HireController()

// Todas as rotas exigem login: contratações expõem dados pessoais das partes
hireRouter.use(authMiddleware);

hireRouter.post('/', controller.create.bind(controller));
hireRouter.get('/booked/:serviceId', controller.bookedSlots.bind(controller));
hireRouter.get('/me', controller.getMine.bind(controller));
hireRouter.get('/provider/:id', controller.getByProviderId.bind(controller));
hireRouter.get('/:id', controller.getById.bind(controller));
hireRouter.put('/:id', controller.update.bind(controller));
hireRouter.delete('/:id', controller.delete.bind(controller));

export default hireRouter
