import express from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import unitsRoutes from './units.routes';
import membershipsRoutes from './memberships.routes';

const router = express.Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(unitsRoutes);
router.use(membershipsRoutes);

export default router;
