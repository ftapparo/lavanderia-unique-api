import express from 'express';
import { membershipsController } from '../controllers/memberships.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/unit-memberships', authMiddleware, asyncHandler(membershipsController.list));
router.post('/unit-memberships', authMiddleware, requireRole('ADMIN'), asyncHandler(membershipsController.create));
router.patch('/unit-memberships/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(membershipsController.update));

export default router;
