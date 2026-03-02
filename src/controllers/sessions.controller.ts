import type { Request, Response } from 'express';
import { sessionsService } from '../services/sessions.service';

export const sessionsController = {
    async getById(req: Request, res: Response) {
        const session = await sessionsService.getSessionById(
            String(req.params.id || ''),
            String(req.auth?.userId),
            req.auth?.role === 'ADMIN',
        );
        res.ok(session);
    },

    async finish(req: Request, res: Response) {
        const session = await sessionsService.finishSession(
            String(req.params.id || ''),
            String(req.auth?.userId),
            req.auth?.role === 'ADMIN',
        );
        res.ok(session);
    },
};
