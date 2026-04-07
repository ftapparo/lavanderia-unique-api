import type { Request, Response } from 'express';
import { usersService } from '../services/users.service';
import type { UserRole } from '../types/domain.types';

export const usersController = {
    async list(req: Request, res: Response) {
        const users = await usersService.list({
            q: req.query?.q ? String(req.query.q) : undefined,
            unitId: req.query?.unitId ? String(req.query.unitId) : undefined,
            slotPosition: req.query?.slotPosition !== undefined ? Number(req.query.slotPosition) : undefined,
            profile: req.query?.profile ? String(req.query.profile) : undefined,
        });
        res.ok(users);
    },

    async getById(req: Request, res: Response) {
        const user = await usersService.getById(String(req.params.id || ''));
        res.ok(user);
    },

    async create(req: Request, res: Response) {
        const result = await usersService.create(
            {
                name: String(req.body?.name || ''),
                cpf: String(req.body?.cpf || ''),
                email: String(req.body?.email || ''),
                phone: req.body?.phone ? String(req.body.phone) : null,
                role: (String(req.body?.role || 'USER')) as UserRole,
                cargo: req.body?.cargo ? String(req.body.cargo) : null,
                profilePhotoBase64: req.body?.profilePhotoBase64 !== undefined
                    ? (req.body.profilePhotoBase64 ? String(req.body.profilePhotoBase64) : null)
                    : undefined,
                profilePhotoMime: req.body?.profilePhotoMime !== undefined
                    ? (req.body.profilePhotoMime ? String(req.body.profilePhotoMime) : null)
                    : undefined,
            },
            String(req.auth?.userId || ''),
        );
        res.ok(result, 201);
    },

    async update(req: Request, res: Response) {
        const user = await usersService.update(
            String(req.params.id || ''),
            {
                name: req.body?.name ? String(req.body.name) : undefined,
                email: req.body?.email ? String(req.body.email) : undefined,
                phone: req.body?.phone !== undefined ? (req.body.phone ? String(req.body.phone) : null) : undefined,
                role: req.body?.role ? (String(req.body.role) as UserRole) : undefined,
                cargo: req.body?.cargo !== undefined ? (req.body.cargo ? String(req.body.cargo) : null) : undefined,
                profilePhotoBase64: req.body?.profilePhotoBase64 !== undefined
                    ? (req.body.profilePhotoBase64 ? String(req.body.profilePhotoBase64) : null)
                    : undefined,
                profilePhotoMime: req.body?.profilePhotoMime !== undefined
                    ? (req.body.profilePhotoMime ? String(req.body.profilePhotoMime) : null)
                    : undefined,
            },
            String(req.auth?.userId || ''),
        );
        res.ok(user);
    },

    async resetPassword(req: Request, res: Response) {
        const result = await usersService.resetPassword(
            String(req.params.id || ''),
            String(req.auth?.userId || ''),
        );
        res.ok(result);
    },

    async remove(req: Request, res: Response) {
        await usersService.delete(String(req.params.id || ''), String(req.auth?.userId || ''));
        res.ok({ deleted: true });
    },
};
