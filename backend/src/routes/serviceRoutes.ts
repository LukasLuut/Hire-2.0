import { Router } from 'express'
import { ServiceController } from '../controllers/ServiceController';
import { upload } from '../middlewares/uploadMiddleware';
import { authMiddleware } from '../middlewares/authMidlleware';

const serviceRouter = Router();
const controller = new ServiceController();

serviceRouter.post('/', upload.single("image"), controller.create.bind(controller));
serviceRouter.get('/', controller.list.bind(controller));
serviceRouter.get('/liked', authMiddleware, controller.likedByMe.bind(controller));
serviceRouter.get('/:id', controller.getById.bind(controller));
serviceRouter.post('/:id/like', authMiddleware, controller.toggleLike.bind(controller));
serviceRouter.put('/:id', upload.single("image"), controller.update.bind(controller));
serviceRouter.delete('/:id', controller.delete.bind(controller));

export default serviceRouter;
