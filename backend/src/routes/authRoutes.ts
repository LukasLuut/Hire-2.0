// src/routes/auth.routes.ts
import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit'
import { AuthController } from '../controllers/AuthController'
import { validateDTO } from '../middlewares/validateDTO'
import { CreateUserDTO } from '../dtos/CreateUserDTO'
import { LoginUserDTO } from '../dtos/LoginUserDTO'
import { authMiddleware } from '../middlewares/authMidlleware'

const router = Router()
const minutes = (n: number) => n * 60_000
const controller = new AuthController()

router.post('/register', rateLimit({ windowMs: minutes(60), max: 20, message: 'Muitos cadastros a partir desta rede. Tente de novo mais tarde.' }), validateDTO(CreateUserDTO), controller.register.bind(controller))
router.post('/login', controller.login.bind(controller))

// Confirmação de e-mail e recuperação de senha (links de uso único enviados por e-mail)
router.post('/verify-email', controller.verifyEmail.bind(controller))
router.post('/resend-verification', authMiddleware, controller.resendVerification.bind(controller))
router.post('/forgot-password', rateLimit({ windowMs: minutes(15), max: 10, message: 'Muitos pedidos de recuperação. Tente de novo em alguns minutos.' }), controller.forgotPassword.bind(controller))
router.post('/reset-password', rateLimit({ windowMs: minutes(15), max: 20 }), controller.resetPassword.bind(controller))

export default router