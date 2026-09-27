import { Router } from 'express'
import { ServiceController } from '../controllers/ServiceController';
import { upload } from '../middlewares/uploadMiddleware';
import { authMiddleware } from '../middlewares/authMidlleware';

const serviceRouter = Router();
const controller = new ServiceController();

const images = upload.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 8 }]);

serviceRouter.post('/', authMiddleware, images, controller.create.bind(controller));
serviceRouter.get('/', controller.list.bind(controller));
serviceRouter.get('/liked', authMiddleware, controller.likedByMe.bind(controller));
serviceRouter.get('/favorites', authMiddleware, controller.favorites.bind(controller));
serviceRouter.get('/:id', controller.getById.bind(controller));
serviceRouter.post('/:id/like', authMiddleware, controller.toggleLike.bind(controller));
serviceRouter.put('/:id', authMiddleware, images, controller.update.bind(controller));
serviceRouter.delete('/:id', authMiddleware, controller.delete.bind(controller));

export default serviceRouter;
