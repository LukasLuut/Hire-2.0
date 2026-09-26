import { Router } from 'express'
import { UserService } from '../services/UserService'
import { imageUpload } from '../middlewares/uploadMiddleware'
import { UserController } from '../controllers/UserController'
import { authMiddleware } from '../middlewares/authMidlleware'

const userRouter = Router()
const controller = new UserController()
const userService = new UserService()

userRouter.get('/me', authMiddleware, controller.getById.bind(controller))
userRouter.put('/me', authMiddleware, controller.update.bind(controller))
userRouter.put('/me/preferences', authMiddleware, controller.preferences.bind(controller))
// foto do perfil pessoal (só imagem)
userRouter.put('/me/avatar', authMiddleware, imageUpload.single('image'), async (req, res) => {
  try {
    res.json(await userService.setAvatar(Number((req as any).user.id), req.file))
  } catch (e: any) {
    res.status(400).json({ message: e.message })
  }
})
userRouter.delete('/me', authMiddleware, controller.remove.bind(controller))
userRouter.post('/me/address', authMiddleware, controller.createAddress.bind(controller))

export default userRouter

