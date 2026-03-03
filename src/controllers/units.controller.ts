import type { Request, Response } from 'express';
import { unitsService } from '../services/units.service';
import { hasAdminAccess } from '../utils/auth-role';

export const unitsController = {
    async list(req: Request, res: Response) {
        const rows = await unitsService.list(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(rows);
    },

    async create(req: Request, res: Response) {
        const unit = await unitsService.create({
            floor: Number(req.body?.floor),
            unitNumber: Number(req.body?.unitNumber),
            active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
            allowGuestReservations: typeof req.body?.allowGuestReservations === 'boolean'
                ? req.body.allowGuestReservations
                : undefined,
        }, String(req.auth?.userId));

        res.ok(unit, 201);
    },

    async update(req: Request, res: Response) {
        const unit = await unitsService.update(String(req.params.id || ''), {
            floor: typeof req.body?.floor === 'number' ? Number(req.body.floor) : undefined,
            unitNumber: typeof req.body?.unitNumber === 'number' ? Number(req.body.unitNumber) : undefined,
            active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
            allowGuestReservations: typeof req.body?.allowGuestReservations === 'boolean'
                ? req.body.allowGuestReservations
                : undefined,
        }, String(req.auth?.userId));

        res.ok(unit);
    },

    async remove(req: Request, res: Response) {
        await unitsService.remove(String(req.params.id || ''), String(req.auth?.userId));
        res.ok({ id: String(req.params.id || ''), removed: true });
    },
};
