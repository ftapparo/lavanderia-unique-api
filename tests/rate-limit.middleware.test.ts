import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from '../src/middleware/rate-limit.middleware';

const createRequest = (ip: string): Request =>
    ({
        ip,
        header: () => undefined,
    } as unknown as Request);

const createResponse = () =>
    ({
        setHeader: jest.fn(),
        fail: jest.fn(),
    } as unknown as Response);

describe('rate-limit.middleware', () => {
    it('bloqueia requisicoes acima do limite com 429 e Retry-After', () => {
        const middleware = rateLimit({
            keyPrefix: `test-${Date.now()}`,
            windowMs: 60_000,
            max: 2,
        });
        const req = createRequest('127.0.0.1');
        const res = createResponse();
        const next = jest.fn() as NextFunction;

        middleware(req, res, next);
        middleware(req, res, next);
        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
        expect(res.fail).toHaveBeenCalledWith(
            'Muitas requisicoes. Tente novamente em instantes.',
            429,
            expect.objectContaining({
                limit: 2,
                windowMs: 60_000,
            }),
        );
    });
});

