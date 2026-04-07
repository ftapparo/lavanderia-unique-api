import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';
import { usersController } from '../controllers/users.controller';

const router = express.Router();

router.get('/users', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.list));
router.get('/users/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.getById));
router.post('/users', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.create));
router.patch('/users/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.update));
router.patch('/users/:id/reset-password', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.resetPassword));
router.delete('/users/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(usersController.remove));

export default router;
