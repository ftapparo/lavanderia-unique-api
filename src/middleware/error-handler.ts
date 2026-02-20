import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
        res.fail(error.message, error.status, error.details);
        return;
    }

    const message = error instanceof Error ? error.message : 'Erro interno';
    res.fail('Erro interno do servidor.', 500, message);
};
