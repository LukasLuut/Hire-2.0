import { Router } from 'express'
import { ContractController } from '../controllers/ContractController';
import { authMiddleware } from '../middlewares/authMidlleware';

const contractRouter = Router();
const controller = new ContractController();

// Contratos só nascem da negociação (POST /conversations/:id/accept) e só as partes os acessam
contractRouter.use(authMiddleware);
contractRouter.get('/:id', controller.getById.bind(controller));
contractRouter.post('/:id/sign', controller.sign.bind(controller));

export default contractRouter;
