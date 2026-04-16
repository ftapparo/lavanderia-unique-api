import type { Request, Response } from 'express';
import { machineMaintenancesService } from '../services/machine-maintenances.service';

export const machineMaintenancesController = {
    async open(req: Request, res: Response) {
        const machineId = String(req.params.machineId || '');
        const problem = String(req.body?.problem || '');
        const startedAt = req.body?.startedAt ? String(req.body.startedAt) : undefined;

        const maintenance = await machineMaintenancesService.open(
            { machineId, problem, startedAt },
            String(req.auth?.userId),
        );

        res.ok(maintenance, 201);
    },

    async close(req: Request, res: Response) {
        const id = String(req.params.id || '');
        const solution = req.body?.solution ? String(req.body.solution) : null;
        const endedAt = req.body?.endedAt ? String(req.body.endedAt) : undefined;

        const maintenance = await machineMaintenancesService.close(
            id,
            { solution, endedAt },
            String(req.auth?.userId),
        );

        res.ok(maintenance);
    },

    async cancel(req: Request, res: Response) {
        const id = String(req.params.id || '');
        await machineMaintenancesService.cancel(id, String(req.auth?.userId));
        res.ok(null);
    },

    async listByMachine(req: Request, res: Response) {
        const machineId = String(req.params.machineId || '');
        const maintenances = await machineMaintenancesService.listByMachine(machineId);
        res.ok(maintenances);
    },

    async listAll(_req: Request, res: Response) {
        const maintenances = await machineMaintenancesService.listAll();
        res.ok(maintenances);
    },

    async listAllPaginated(req: Request, res: Response) {
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const maintenances = await machineMaintenancesService.listAllPaginated({ cursor, limit });
        res.ok(maintenances);
    },
};
