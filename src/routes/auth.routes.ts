import express from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = express.Router();
const authRateLimit = rateLimit({ keyPrefix: 'auth', windowMs: 60_000, max: 20 });

router.post('/auth/register', authRateLimit, asyncHandler(authController.register));
router.post('/auth/login', authRateLimit, asyncHandler(authController.login));
router.post('/auth/refresh', authRateLimit, asyncHandler(authController.refresh));
router.get('/auth/me', authMiddleware, asyncHandler(authController.me));

export default router;
