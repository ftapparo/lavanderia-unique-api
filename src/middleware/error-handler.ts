import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestContext = {
        method: _req.method,
        path: _req.originalUrl,
        requestId: _req.requestId ?? null,
        actor: _req.actor ?? null,
    };

    if (error instanceof AppError) {
        logger.warn('API_APP_ERROR', {
            ...requestContext,
            status: error.status,
            message: error.message,
            details: error.details ?? null,
        });
        res.fail(error.message, error.status, error.details);
        return;
    }

    const message = error instanceof Error ? error.message : 'Erro interno';
    logger.error('API_UNHANDLED_ERROR', {
        ...requestContext,
        message,
        stack: error instanceof Error ? error.stack : null,
    });
    res.fail('Erro interno do servidor.', 500, message);
};
