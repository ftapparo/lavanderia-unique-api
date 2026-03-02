import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { reservationsController } from '../controllers/reservations.controller';

const router = express.Router();

router.get('/reservations', authMiddleware, asyncHandler(reservationsController.list));
router.post('/reservations', authMiddleware, asyncHandler(reservationsController.create));
router.post('/reservations/:id/cancel', authMiddleware, asyncHandler(reservationsController.cancel));

export default router;
