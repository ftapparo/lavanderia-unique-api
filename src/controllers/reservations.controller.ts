import type { Request, Response } from 'express';
import { reservationsService } from '../services/reservations.service';

export const reservationsController = {
    async create(req: Request, res: Response) {
        const reservation = await reservationsService.create({
            unitId: String(req.body?.unitId || ''),
            machinePairId: String(req.body?.machinePairId || ''),
            startAt: String(req.body?.startAt || ''),
        }, String(req.auth?.userId));

        res.ok(reservation, 201);
    },

    async list(req: Request, res: Response) {
        const rows = await reservationsService.list(String(req.auth?.userId), req.auth?.role === 'ADMIN');
        res.ok(rows);
    },

    async cancel(req: Request, res: Response) {
        const reservation = await reservationsService.cancel(
            String(req.params.id || ''),
            String(req.auth?.userId),
            req.auth?.role === 'ADMIN',
        );
        res.ok(reservation);
    },
};
