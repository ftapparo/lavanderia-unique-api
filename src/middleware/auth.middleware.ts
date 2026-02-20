import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { verifyJwt } from '../utils/jwt';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
        res.fail('Nao autenticado.', 401);
        return;
    }

    const token = authorization.slice('Bearer '.length).trim();

    try {
        const payload = verifyJwt(token, env.jwtSecret);

        if (payload.type !== 'access') {
            res.fail('Token invalido.', 401);
            return;
        }

        req.auth = {
            userId: payload.sub,
            role: payload.role,
            tokenType: payload.type,
        };

        next();
        return;
    } catch (error) {
        res.fail('Token invalido.', 401, error instanceof Error ? error.message : error);
    }
};
