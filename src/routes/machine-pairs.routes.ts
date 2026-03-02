import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';
import { machinePairsController } from '../controllers/machine-pairs.controller';

const router = express.Router();

router.get('/machine-pairs', authMiddleware, asyncHandler(machinePairsController.list));
router.post('/machine-pairs', authMiddleware, requireRole('ADMIN'), asyncHandler(machinePairsController.create));

export default router;
