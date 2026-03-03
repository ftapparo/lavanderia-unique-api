import express from 'express';
import { incidentsController } from '../controllers/incidents.controller';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/incidents', authMiddleware, asyncHandler(incidentsController.list));

export default router;
