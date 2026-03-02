import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { machinesController } from '../controllers/machines.controller';

const router = express.Router();

router.get('/machines', authMiddleware, asyncHandler(machinesController.list));

export default router;
