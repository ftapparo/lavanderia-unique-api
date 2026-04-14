import express from 'express';
import { adminController } from '../controllers/admin.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/admin/dashboard', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.dashboard));
router.get('/admin/ops/health', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.opsHealth));
router.get('/admin/ops/active-sessions', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.listActiveSessions));
router.post('/admin/ops/reconcile-session/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.reconcileSession));
router.get('/admin/jobs', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.listJobs));
router.patch('/admin/jobs/:name', authMiddleware, requireRole('ADMIN'), asyncHandler(adminController.updateJob));

export default router;
