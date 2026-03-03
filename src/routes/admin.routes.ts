import express from 'express';
import { adminController } from '../controllers/admin.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/admin/dashboard', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.dashboard));

export default router;
