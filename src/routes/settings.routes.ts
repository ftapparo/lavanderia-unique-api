import express from 'express';
import { settingsController } from '../controllers/settings.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/settings', authMiddleware, asyncHandler(settingsController.get));
router.patch('/settings', authMiddleware, requireRole('ADMIN'), asyncHandler(settingsController.update));

export default router;
