import express from 'express';
import { unitsController } from '../controllers/units.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/units', authMiddleware, asyncHandler(unitsController.list));
router.post('/units', authMiddleware, requireRole('ADMIN'), asyncHandler(unitsController.create));
router.patch('/units/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(unitsController.update));
router.delete('/units/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(unitsController.remove));

export default router;
