import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { reservationsController } from '../controllers/reservations.controller';

const router = express.Router();

router.get('/reservations', authMiddleware, asyncHandler(reservationsController.list));
router.get('/reservations/busy', authMiddleware, asyncHandler(reservationsController.listBusy));
router.post('/reservations', authMiddleware, asyncHandler(reservationsController.create));
router.post('/reservations/:id/cancel', authMiddleware, asyncHandler(reservationsController.cancel));
router.post('/reservations/:id/check-in', authMiddleware, asyncHandler(reservationsController.checkin));

export default router;
