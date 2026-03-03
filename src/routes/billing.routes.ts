import express from 'express';
import { billingController } from '../controllers/billing.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.post('/billing/run', authMiddleware, requireRole('ADMIN'), asyncHandler(billingController.run));
router.get('/invoices', authMiddleware, asyncHandler(billingController.listInvoices));
router.get('/invoices/:id', authMiddleware, asyncHandler(billingController.getInvoiceById));
router.get('/billing/exports/:competence', authMiddleware, requireRole('ADMIN'), asyncHandler(billingController.exportCompetence));

export default router;
