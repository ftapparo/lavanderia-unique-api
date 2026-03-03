import type { Request, Response } from 'express';
import { incidentsService } from '../services/incidents.service';
import { hasAdminAccess } from '../utils/auth-role';

export const incidentsController = {
    async list(req: Request, res: Response) {
        const rows = await incidentsService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(rows);
    },
};
