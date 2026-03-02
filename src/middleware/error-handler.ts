import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestContext = {
        method: _req.method,
        path: _req.originalUrl,
        requestId: _req.requestId ?? null,
        actor: _req.actor ?? null,
    };

    if (error instanceof AppError) {
        console.warn('[API][AppError]', {
            ...requestContext,
            status: error.status,
            message: error.message,
            details: error.details ?? null,
        });
        res.fail(error.message, error.status, error.details);
        return;
    }

    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[API][UnhandledError]', {
        ...requestContext,
        message,
        stack: error instanceof Error ? error.stack : null,
    });
    res.fail('Erro interno do servidor.', 500, message);
};
