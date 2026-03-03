import type { Request, Response } from 'express';
import { sessionsService } from '../services/sessions.service';
import { hasAdminAccess } from '../utils/auth-role';

export const sessionsController = {
    async getByReservationId(req: Request, res: Response) {
        const session = await sessionsService.getSessionByReservationId(
            String(req.params.reservationId || ''),
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },

    async getById(req: Request, res: Response) {
        const session = await sessionsService.getSessionById(
            String(req.params.id || ''),
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },

    async finish(req: Request, res: Response) {
        const session = await sessionsService.finishSession(
            String(req.params.id || ''),
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(session);
    },
};
