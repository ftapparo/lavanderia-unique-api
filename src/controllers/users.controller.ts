import type { Request, Response } from 'express';
import { usersService } from '../services/users.service';

export const usersController = {
    async list(_req: Request, res: Response) {
        const users = await usersService.list();
        res.ok(users);
    },
};
