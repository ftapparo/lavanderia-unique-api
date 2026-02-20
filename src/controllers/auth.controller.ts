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

    async me(req: Request, res: Response) {
        const result = await authService.me(String(req.auth?.userId || ''));
        res.ok(result);
    },
};
