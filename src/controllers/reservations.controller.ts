import type { Request, Response } from 'express';
import { reservationsService } from '../services/reservations.service';
import { sessionsService } from '../services/sessions.service';

export const reservationsController = {
    async create(req: Request, res: Response) {
        const reservation = await reservationsService.create({
            unitId: String(req.body?.unitId || ''),
            machinePairId: String(req.body?.machinePairId || ''),
            startAt: String(req.body?.startAt || ''),
            userId: req.body?.userId ? String(req.body.userId) : undefined,
        }, String(req.auth?.userId), req.auth?.role === 'ADMIN');

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

    async checkin(req: Request, res: Response) {
        const session = await sessionsService.checkinReservation(
            String(req.params.id || ''),
            String(req.auth?.userId),
            req.auth?.role === 'ADMIN',
        );
        res.ok(session);
    },
};
