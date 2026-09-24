import { Router } from 'express'
import { HireController } from '../controllers/HireController';
import { authMiddleware } from '../middlewares/authMidlleware';

const hireRouter = Router()
const controller = new HireController()

hireRouter.post('/', controller.create.bind(controller));
hireRouter.get('/', controller.list.bind(controller));
hireRouter.get('/me', authMiddleware, controller.getMine.bind(controller));
hireRouter.get('/provider/:id', controller.getByProviderId.bind(controller));
hireRouter.get('/:id', controller.getById.bind(controller));
hireRouter.put('/:id', controller.update.bind(controller));
hireRouter.delete('/:id', controller.delete.bind(controller));

export default hireRouter
