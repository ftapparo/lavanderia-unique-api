import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
    async register(req: Request, res: Response) {
        const result = await authService.register({
            name: String(req.body?.name || ''),
            cpf: String(req.body?.cpf || ''),
            email: String(req.body?.email || ''),
            phone: req.body?.phone ? String(req.body.phone) : undefined,
            password: String(req.body?.password || ''),
        });

        res.ok(result, 201);
    },

    async login(req: Request, res: Response) {
        const result = await authService.login({
            identity: String(req.body?.identity || req.body?.email || req.body?.cpf || ''),
            password: String(req.body?.password || ''),
        });

        res.ok(result);
    },

    async refresh(req: Request, res: Response) {
        const result = await authService.refresh(String(req.body?.refreshToken || ''));
        res.ok(result);
    },

    async forgotPassword(req: Request, res: Response) {
        const result = await authService.forgotPassword({
            identity: String(req.body?.identity || req.body?.email || req.body?.cpf || ''),
        });
        res.ok(result);
    },

    async resetPassword(req: Request, res: Response) {
        const result = await authService.resetPasswordByPin({
            identity: String(req.body?.identity || req.body?.email || req.body?.cpf || ''),
            pin: String(req.body?.pin || ''),
            newPassword: String(req.body?.newPassword || ''),
        });
        res.ok(result);
    },

    async me(req: Request, res: Response) {
        const result = await authService.me(String(req.auth?.userId || ''));
        res.ok(result);
    },

    async updateMe(req: Request, res: Response) {
        const result = await authService.updateMe(String(req.auth?.userId || ''), {
            email: req.body?.email !== undefined ? String(req.body.email) : undefined,
            phone: req.body?.phone !== undefined ? (req.body.phone ? String(req.body.phone) : null) : undefined,
            profilePhotoBase64: req.body?.profilePhotoBase64 !== undefined
                ? (req.body.profilePhotoBase64 ? String(req.body.profilePhotoBase64) : null)
                : undefined,
            profilePhotoMime: req.body?.profilePhotoMime !== undefined
                ? (req.body.profilePhotoMime ? String(req.body.profilePhotoMime) : null)
                : undefined,
        });
        res.ok(result);
    },

    async changePassword(req: Request, res: Response) {
        await authService.changePassword(String(req.auth?.userId || ''), {
            currentPassword: String(req.body?.currentPassword || ''),
            newPassword: String(req.body?.newPassword || ''),
        });
        res.ok({ changed: true });
    },
};
