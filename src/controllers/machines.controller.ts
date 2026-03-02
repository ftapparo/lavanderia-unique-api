import type { Request, Response } from 'express';
import { machinesService } from '../services/machines.service';

export const machinesController = {
    async create(req: Request, res: Response) {
        const machine = await machinesService.create({
            unitId: String(req.body?.unitId || ''),
            name: String(req.body?.name || ''),
            type: String(req.body?.type || '').toUpperCase() as 'WASHER' | 'DRYER',
            tuyaDeviceId: req.body?.tuyaDeviceId ? String(req.body.tuyaDeviceId) : null,
            active: typeof req.body?.active === 'boolean' ? req.body.active : true,
        }, String(req.auth?.userId));

        res.ok(machine, 201);
    },

    async list(req: Request, res: Response) {
        const machines = await machinesService.list(String(req.auth?.userId), req.auth?.role === 'ADMIN');
        res.ok(machines);
    },
};
