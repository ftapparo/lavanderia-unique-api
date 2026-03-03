import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyPrefix: string;
};

type Bucket = {
    hits: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

const resolveIp = (req: Request): string => {
    const forwarded = req.header('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
    }
    return req.ip || 'unknown';
};

export const rateLimit = (options: RateLimitOptions) => (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix}:${resolveIp(req)}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
        buckets.set(key, {
            hits: 1,
            resetAt: now + options.windowMs,
        });
        next();
        return;
    }

    current.hits += 1;
    if (current.hits > options.max) {
        const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        res.fail('Muitas requisicoes. Tente novamente em instantes.', 429, {
            retryAfterSec,
            limit: options.max,
            windowMs: options.windowMs,
        });
        return;
    }

    next();
};

