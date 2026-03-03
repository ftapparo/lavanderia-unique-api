import express from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import unitsRoutes from './units.routes';
import membershipsRoutes from './memberships.routes';
import machinesRoutes from './machines.routes';
import machinePairsRoutes from './machine-pairs.routes';
import reservationsRoutes from './reservations.routes';
import usersRoutes from './users.routes';
import sessionsRoutes from './sessions.routes';
import incidentsRoutes from './incidents.routes';
import settingsRoutes from './settings.routes';
import billingRoutes from './billing.routes';
import adminRoutes from './admin.routes';

const router = express.Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(unitsRoutes);
router.use(membershipsRoutes);
router.use(machinesRoutes);
router.use(machinePairsRoutes);
router.use(reservationsRoutes);
router.use(usersRoutes);
router.use(sessionsRoutes);
router.use(incidentsRoutes);
router.use(settingsRoutes);
router.use(billingRoutes);
router.use(adminRoutes);

export default router;
