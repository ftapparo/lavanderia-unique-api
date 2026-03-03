import type { Request, Response } from 'express';
import { adminController } from '../src/controllers/admin.controller';
import { db } from '../src/db/pool';
import { tuyaClient } from '../src/integrations/tuya/tuya-client';

describe('admin.controller', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('retorna 400 ao reconciliar sessao com id invalido', async () => {
        const req = {
            params: { id: 'invalido' },
            auth: { userId: '550e8400-e29b-41d4-a716-446655440000', role: 'ADMIN' },
        } as unknown as Request;
        const res = { ok: jest.fn() } as unknown as Response;

        await expect(adminController.reconcileSession(req, res)).rejects.toMatchObject({
            status: 400,
            message: 'Identificador de sessao invalido.',
        });
    });

    it('retorna status de saude com erro quando db e tuya falham', async () => {
        jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('db down'));
        jest.spyOn(tuyaClient, 'health').mockRejectedValueOnce(new Error('tuya down'));

        const req = {} as Request;
        const res = { ok: jest.fn() } as unknown as Response;

        await adminController.opsHealth(req, res);

        expect(res.ok).toHaveBeenCalledWith(expect.objectContaining({
            db: 'error',
            tuya: 'error',
            tuyaDetails: 'tuya down',
            checkedAt: expect.any(String),
        }));
    });
});

