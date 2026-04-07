import type { Request, Response } from 'express';
import { membershipsService } from '../services/memberships.service';
import { hasAdminAccess } from '../utils/auth-role';

export const membershipsController = {
    async listProfiles(_req: Request, res: Response) {
        const rows = await membershipsService.listProfiles();
        res.ok(rows);
    },

    async list(req: Request, res: Response) {
        const rows = await membershipsService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(rows);
    },

    async create(req: Request, res: Response) {
        const membership = await membershipsService.create({
            userId: String(req.body?.userId || ''),
            unitId: String(req.body?.unitId || ''),
            slotPosition: req.body?.slotPosition !== undefined ? Number(req.body.slotPosition) : undefined,
            profile: String(req.body?.profile || ''),
            startDate: String(req.body?.startDate || ''),
            endDate: req.body?.endDate ? String(req.body.endDate) : null,
            active: typeof req.body?.active === 'boolean' ? req.body.active : true,
        }, String(req.auth?.userId));

        res.ok(membership, 201);
    },

    async update(req: Request, res: Response) {
        const membership = await membershipsService.update(String(req.params.id), {
            slotPosition: req.body?.slotPosition !== undefined ? Number(req.body.slotPosition) : undefined,
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
