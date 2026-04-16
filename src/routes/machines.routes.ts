import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { authMiddleware } from '../middleware/auth.middleware';
import { machinesController } from '../controllers/machines.controller';
import { machineMaintenancesController } from '../controllers/machine-maintenances.controller';
import { requireRole } from '../middleware/require-role.middleware';

const router = express.Router();

router.get('/machines', authMiddleware, asyncHandler(machinesController.list));
router.post('/machines', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.create));
router.patch('/machines/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.update));
router.delete('/machines/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(machinesController.remove));

// Manutenções
router.get('/maintenances', authMiddleware, asyncHandler(machineMaintenancesController.listAll));
router.get('/maintenances/feed', authMiddleware, asyncHandler(machineMaintenancesController.listAllPaginated));
router.get('/machines/:machineId/maintenances', authMiddleware, asyncHandler(machineMaintenancesController.listByMachine));
router.post('/machines/:machineId/maintenances', authMiddleware, requireRole('ADMIN'), asyncHandler(machineMaintenancesController.open));
router.patch('/maintenances/:id/close', authMiddleware, requireRole('ADMIN'), asyncHandler(machineMaintenancesController.close));
router.delete('/maintenances/:id', authMiddleware, requireRole('ADMIN'), asyncHandler(machineMaintenancesController.cancel));

export default router;
