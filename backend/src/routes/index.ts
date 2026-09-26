// src/routes/index.ts
import { Router } from 'express'
import authRoutes from './authRoutes'
import userRouter from './UserRoutes'
import categoryRouter from './categoryRoutes'
import providerRouter from './providerRoutes'
import serviceRouter from './serviceRoutes'
import hireRouter from './hireRoutes'
import paymentRouter from './paymentRoutes'
import contractRouter from './contractRoutes'
import reviewRouter from './reviewRoutes'
import conversationRouter from './conversationRoutes'
import notificationRouter from './notificationRoutes';
import adminRouter from './adminRoutes';
import reportRouter from './reportRoutes';
import eventRouter from './eventRoutes';
import analyticsRouter from './analyticsRoutes';
import discoverRouter from './discoverRoutes';
import inviteRouter from './inviteRoutes';

const router = Router()

router.use('/auth', authRoutes);
router.use('/users', userRouter);
router.use('/categories', categoryRouter);
router.use('/providers', providerRouter);
router.use('/services', serviceRouter);
router.use('/hires', hireRouter);
router.use('/payments', paymentRouter);
router.use('/contracts', contractRouter);
router.use('/reviews', reviewRouter);
router.use('/conversations', conversationRouter);
router.use('/notifications', notificationRouter);
router.use('/admin', adminRouter);
router.use('/reports', reportRouter);
router.use('/events', eventRouter);
router.use('/analytics', analyticsRouter);
router.use('/discover', discoverRouter);
router.use('/invites', inviteRouter);

export default router
