import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import authRoutes from './auth';
import integrationRoutes from './integrations';
import productRoutes from './products';
import orderRoutes from './orders';
import customerRoutes from './customers';
import webhookRoutes from './webhooks';
import conversationRoutes from './conversations';
import settingsRoutes from './settings';
import campaignRoutes from './campaigns';
import loyaltyRoutes from './loyalty';
import teamRoutes from './team';
import superAdminRoutes from './superadmin';

const router = Router();

// Public
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);

// Protected
router.use('/integrations', authMiddleware, integrationRoutes);
router.use('/products', authMiddleware, productRoutes);
router.use('/orders', authMiddleware, orderRoutes);
router.use('/customers', authMiddleware, customerRoutes);
router.use('/conversations', authMiddleware, conversationRoutes);
router.use('/settings', authMiddleware, settingsRoutes);
router.use('/campaigns', authMiddleware, campaignRoutes);
router.use('/loyalty', authMiddleware, loyaltyRoutes);
router.use('/team', authMiddleware, teamRoutes);
router.use('/superadmin', superAdminRoutes); // has own auth middleware internally

export default router;
