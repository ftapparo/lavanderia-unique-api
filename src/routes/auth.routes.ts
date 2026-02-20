import express from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/auth/register', asyncHandler(authController.register));
router.post('/auth/login', asyncHandler(authController.login));
router.post('/auth/refresh', asyncHandler(authController.refresh));
router.get('/auth/me', authMiddleware, asyncHandler(authController.me));

export default router;
