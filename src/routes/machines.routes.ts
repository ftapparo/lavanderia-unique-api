import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { machinesController } from '../controllers/machines.controller';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/machines', authMiddleware, asyncHandler(machinesController.list));
router.post('/machines', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.create));
router.patch('/machines/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.update));
router.delete('/machines/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.remove));

export default router;
