import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';
import { usersController } from '../controllers/users.controller';

const router = express.Router();

router.get('/users', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.list));

export default router;
