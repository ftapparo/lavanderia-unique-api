import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { sessionsController } from '../controllers/sessions.controller';

const router = express.Router();

router.get('/sessions/by-reservation/:reservationId', authMiddleware, asyncHandler(sessionsController.getByReservationId));
router.get('/sessions/:id', authMiddleware, asyncHandler(sessionsController.getById));
router.post('/sessions/:id/finish', authMiddleware, asyncHandler(sessionsController.finish));

export default router;
