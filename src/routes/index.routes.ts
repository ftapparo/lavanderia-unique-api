import express from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import unitsRoutes from './units.routes';
import membershipsRoutes from './memberships.routes';
import machinesRoutes from './machines.routes';
import machinePairsRoutes from './machine-pairs.routes';
import reservationsRoutes from './reservations.routes';
import usersRoutes from './users.routes';

const router = express.Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(unitsRoutes);
router.use(membershipsRoutes);
router.use(machinesRoutes);
router.use(machinePairsRoutes);
router.use(reservationsRoutes);
router.use(usersRoutes);

export default router;
