import type { Request, Response } from 'express';
import { membershipsService } from '../services/memberships.service';

export const membershipsController = {
    async list(req: Request, res: Response) {
        const rows = await membershipsService.list(String(req.auth?.userId), req.auth?.role === 'ADMIN');
        res.ok(rows);
    },

    async create(req: Request, res: Response) {
        const membership = await membershipsService.create({
            userId: String(req.body?.userId || ''),
            unitId: String(req.body?.unitId || ''),
            profile: String(req.body?.profile || ''),
            startDate: String(req.body?.startDate || ''),
            endDate: req.body?.endDate ? String(req.body.endDate) : null,
            active: typeof req.body?.active === 'boolean' ? req.body.active : true,
        }, String(req.auth?.userId));

        res.ok(membership, 201);
    },

    async update(req: Request, res: Response) {
        const membership = await membershipsService.update(String(req.params.id), {
            profile: req.body?.profile ? String(req.body.profile) : undefined,
            startDate: req.body?.startDate ? String(req.body.startDate) : undefined,
            endDate: req.body?.endDate !== undefined
                ? (req.body.endDate ? String(req.body.endDate) : null)
                : undefined,
            active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
        }, String(req.auth?.userId));

        res.ok(membership);
    },
};
