// src/routes/auth.routes.ts
import { Router } from 'express'
import { AuthController } from '../controllers/AuthController'
import { validateDTO } from '../middlewares/validateDTO'
import { CreateUserDTO } from '../dtos/CreateUserDTO'
import { LoginUserDTO } from '../dtos/LoginUserDTO'
import { authMiddleware } from '../middlewares/authMidlleware'

const router = Router()
const controller = new AuthController()

router.post('/register', validateDTO(CreateUserDTO), controller.register.bind(controller))
router.post('/login', controller.login.bind(controller))

// Confirmação de e-mail e recuperação de senha (links de uso único enviados por e-mail)
router.post('/verify-email', controller.verifyEmail.bind(controller))
router.post('/resend-verification', authMiddleware, controller.resendVerification.bind(controller))
router.post('/forgot-password', controller.forgotPassword.bind(controller))
router.post('/reset-password', controller.resetPassword.bind(controller))

export default router