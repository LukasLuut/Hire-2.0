import { Router } from 'express'
import { ContractController } from '../controllers/ContractController';
import { authMiddleware } from '../middlewares/authMidlleware';

const contractRouter = Router();
const controller = new ContractController();

contractRouter.post('/', controller.create.bind(controller));
contractRouter.get('/', controller.list.bind(controller));
contractRouter.get('/:id', authMiddleware, controller.getById.bind(controller));
contractRouter.put('/:id', controller.update.bind(controller));
contractRouter.delete('/:id', controller.delete.bind(controller));

export default contractRouter;

