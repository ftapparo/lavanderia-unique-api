import type { Request, Response } from 'express';

export const healthCheck = (_req: Request, res: Response) => {
    const env = process.env.NODE_ENV || 'UNKNOWN';
    res.ok({ status: 'API Funcionando!', environment: env });
};
