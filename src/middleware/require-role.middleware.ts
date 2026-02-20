import type { NextFunction, Request, Response } from 'express';

export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
        res.fail('Nao autenticado.', 401);
        return;
    }

    if (!roles.includes(req.auth.role)) {
        res.fail('Acesso negado.', 403);
        return;
    }

    next();
};
