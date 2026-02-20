import type { Request, Response } from 'express';
import { unitsService } from '../services/units.service';

export const unitsController = {
    async list(req: Request, res: Response) {
        const rows = await unitsService.list(String(req.auth?.userId), req.auth?.role === 'ADMIN');
        res.ok(rows);
    },

    async create(req: Request, res: Response) {
        const unit = await unitsService.create({
            name: String(req.body?.name || ''),
            code: String(req.body?.code || ''),
        }, String(req.auth?.userId));

        res.ok(unit, 201);
    },
};
