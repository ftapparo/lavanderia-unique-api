import type { Request, Response } from 'express';
import { machinesService } from '../services/machines.service';
import { hasAdminAccess } from '../utils/auth-role';

export const machinesController = {
    async create(req: Request, res: Response) {
        const machine = await machinesService.create({
            number: Number(req.body?.number),
            brand: String(req.body?.brand || ''),
            model: String(req.body?.model || ''),
            type: String(req.body?.type || '').toUpperCase() as 'WASHER' | 'DRYER',
            tuyaDeviceId: req.body?.tuyaDeviceId ? String(req.body.tuyaDeviceId) : null,
            active: typeof req.body?.active === 'boolean' ? req.body.active : true,
        }, String(req.auth?.userId));

        res.ok(machine, 201);
    },

    async list(req: Request, res: Response) {
        const machines = await machinesService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(machines);
    },

    async update(req: Request, res: Response) {
        const machine = await machinesService.update(String(req.params.id || ''), {
            number: typeof req.body?.number === 'number' ? Number(req.body.number) : undefined,
            brand: req.body?.brand ? String(req.body.brand) : undefined,
            model: req.body?.model ? String(req.body.model) : undefined,
            type: req.body?.type ? String(req.body.type).toUpperCase() as 'WASHER' | 'DRYER' : undefined,
            tuyaDeviceId: req.body?.tuyaDeviceId !== undefined
                ? (req.body.tuyaDeviceId ? String(req.body.tuyaDeviceId) : null)
                : undefined,
            active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
        }, String(req.auth?.userId));

        res.ok(machine);
    },

    async remove(req: Request, res: Response) {
        await machinesService.remove(String(req.params.id || ''), String(req.auth?.userId));
        res.ok({ id: String(req.params.id || ''), removed: true });
    },
};
