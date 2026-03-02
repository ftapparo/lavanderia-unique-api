import type { Request, Response } from 'express';
import { machinesService } from '../services/machines.service';

export const machinesController = {
    async list(req: Request, res: Response) {
        const machines = await machinesService.list(String(req.auth?.userId), req.auth?.role === 'ADMIN');
        res.ok(machines);
    },
};
