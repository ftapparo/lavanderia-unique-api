import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const nowMs = (): number => Date.now();

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startedAt = nowMs();

    res.on('finish', () => {
        logger.info('HTTP_REQUEST', {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: nowMs() - startedAt,
            requestId: req.requestId ?? null,
            actor: req.actor ?? null,
        });
    });

    next();
};

