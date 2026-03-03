import type { Request, Response } from 'express';
import { machinePairsService } from '../services/machine-pairs.service';
import { hasAdminAccess } from '../utils/auth-role';

export const machinePairsController = {
    async create(req: Request, res: Response) {
        const pair = await machinePairsService.create({
            name: String(req.body?.name || ''),
            washerMachineId: String(req.body?.washerMachineId || ''),
            dryerMachineId: String(req.body?.dryerMachineId || ''),
            active: typeof req.body?.active === 'boolean' ? req.body.active : true,
        }, String(req.auth?.userId));

        res.ok(pair, 201);
    },

    async list(req: Request, res: Response) {
        const rows = await machinePairsService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(rows);
    },
};
