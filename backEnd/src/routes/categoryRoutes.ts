import { Router } from 'express'
import { CategoryController } from '../controllers/CategoryController'
import { authMiddleware } from '../middlewares/authMidlleware'
import { adminMiddleware } from '../middlewares/adminMiddleware'

const categoryRouter = Router()
const controller = new CategoryController()

// Leitura é pública; criar, editar e excluir categorias é só da administração
categoryRouter.get('/', controller.list.bind(controller));
categoryRouter.get('/:id', controller.getById.bind(controller));
categoryRouter.post('/', authMiddleware, adminMiddleware, controller.create.bind(controller));
categoryRouter.put('/:id', authMiddleware, adminMiddleware, controller.update.bind(controller));
categoryRouter.delete('/:id', authMiddleware, adminMiddleware, controller.delete.bind(controller));

export default categoryRouter
