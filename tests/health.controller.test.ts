import type { Request, Response } from 'express';
import { healthCheck } from '../src/controllers/health.controller';

describe('health.controller', () => {
    const createResponse = () => {
        const json = jest.fn();
        const status = jest.fn(() => ({ json }));
        return { status, json };
    };

    it('returns current NODE_ENV when defined', () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';

        const res = createResponse();
        healthCheck({} as Request, res as unknown as Response);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            data: { status: 'API Funcionando!', environment: 'test' },
            message: null,
            errors: null,
        });

        process.env.NODE_ENV = previousEnv;
    });

    it('returns UNKNOWN when NODE_ENV is undefined', () => {
        const previousEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        const res = createResponse();
        healthCheck({} as Request, res as unknown as Response);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            data: { status: 'API Funcionando!', environment: 'UNKNOWN' },
            message: null,
            errors: null,
        });

        process.env.NODE_ENV = previousEnv;
    });
});
