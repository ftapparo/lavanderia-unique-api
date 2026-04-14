import type { Request, Response } from 'express';
import { reservationsService } from '../services/reservations.service';
import { sessionsService } from '../services/sessions.service';
import { hasAdminAccess } from '../utils/auth-role';
import { AppError } from '../utils/app-error';
import { isUuid } from '../utils/validators';

export const reservationsController = {
    async create(req: Request, res: Response) {
        const unitId = String(req.body?.unitId || '');
        const machinePairId = String(req.body?.machinePairId || '');
        const userId = req.body?.userId ? String(req.body.userId) : undefined;

        if (!isUuid(unitId) || !isUuid(machinePairId)) {
            throw new AppError('Identificadores de unidade/par invalidos.', 400);
        }
        if (userId && !isUuid(userId)) {
            throw new AppError('Identificador de usuario invalido.', 400);
        }

        const reservation = await reservationsService.create({
            unitId,
            machinePairId,
            startAt: String(req.body?.startAt || ''),
            userId,
        }, String(req.auth?.userId), hasAdminAccess(req.auth?.role));

        res.ok(reservation, 201);
    },

    async list(req: Request, res: Response) {
        const rows = await reservationsService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(rows);
    },

    async listBusy(_req: Request, res: Response) {
        const rows = await reservationsService.listBusy();
        res.ok(rows);
    },

    async feed(req: Request, res: Response) {
        const cursor    = String(req.query.cursor    || new Date().toISOString());
        const direction = req.query.direction === 'before' ? 'before' : 'after';
        const limit     = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5));
        const date      = req.query.date ? String(req.query.date) : undefined;

        const rows = await reservationsService.feed(String(req.auth?.userId), {
            cursor,
            direction,
            limit,
            date,
        });
        res.ok(rows);
    },

    async cancel(req: Request, res: Response) {
        const reservationId = String(req.params.id || '');
        if (!isUuid(reservationId)) {
            throw new AppError('Identificador de reserva invalido.', 400);
        }

        const reservation = await reservationsService.cancel(
            reservationId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(reservation);
    },

    async checkin(req: Request, res: Response) {
        const reservationId = String(req.params.id || '');
        if (!isUuid(reservationId)) {
            throw new AppError('Identificador de reserva invalido.', 400);
        }

        const session = await sessionsService.checkinReservation(
            reservationId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },
};
