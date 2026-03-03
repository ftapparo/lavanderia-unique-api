import type { Request, Response } from 'express';
import { sessionsService } from '../services/sessions.service';
import { hasAdminAccess } from '../utils/auth-role';
import { AppError } from '../utils/app-error';
import { isUuid } from '../utils/validators';

export const sessionsController = {
    async getByReservationId(req: Request, res: Response) {
        const reservationId = String(req.params.reservationId || '');
        if (!isUuid(reservationId)) {
            throw new AppError('Identificador de reserva invalido.', 400);
        }

        const session = await sessionsService.getSessionByReservationId(
            reservationId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },

    async getById(req: Request, res: Response) {
        const sessionId = String(req.params.id || '');
        if (!isUuid(sessionId)) {
            throw new AppError('Identificador de sessao invalido.', 400);
        }

        const session = await sessionsService.getSessionById(
            sessionId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },

    async finish(req: Request, res: Response) {
        const sessionId = String(req.params.id || '');
        if (!isUuid(sessionId)) {
            throw new AppError('Identificador de sessao invalido.', 400);
        }

        const session = await sessionsService.finishSession(
            sessionId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },
};
