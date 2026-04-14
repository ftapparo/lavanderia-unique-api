import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { reservationsController } from '../controllers/reservations.controller';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = express.Router();
const checkinRateLimit = rateLimit({ keyPrefix: 'checkin', windowMs: 60_000, max: 12 });

router.get('/reservations', authMiddleware, asyncHandler(reservationsController.list));
router.get('/reservations/busy', authMiddleware, asyncHandler(reservationsController.listBusy));
router.get('/reservations/feed', authMiddleware, asyncHandler(reservationsController.feed));
router.post('/reservations', authMiddleware, asyncHandler(reservationsController.create));
router.post('/reservations/:id/cancel', authMiddleware, asyncHandler(reservationsController.cancel));
router.post('/reservations/:id/check-in', authMiddleware, checkinRateLimit, asyncHandler(reservationsController.checkin));

export default router;
