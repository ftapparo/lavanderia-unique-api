import type { Request, Response } from 'express';
import { billingController } from '../src/controllers/billing.controller';
import { reservationsController } from '../src/controllers/reservations.controller';
import { sessionsController } from '../src/controllers/sessions.controller';
import { billingService } from '../src/services/billing.service';
import { sessionsService } from '../src/services/sessions.service';
import { reservationsService } from '../src/services/reservations.service';

describe('controllers validations', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('bloqueia competencia invalida em billing.run', async () => {
        const req = { body: { competence: '2026/03' } } as unknown as Request;
        const res = { ok: jest.fn() } as unknown as Response;
        const runSpy = jest.spyOn(billingService, 'run');

        await expect(billingController.run(req, res)).rejects.toMatchObject({
            status: 400,
            message: 'Competencia invalida. Use YYYY-MM.',
        });
        expect(runSpy).not.toHaveBeenCalled();
    });

    it('bloqueia invoice id invalido em billing.getInvoiceById', async () => {
        const req = { params: { id: 'abc' }, auth: { userId: 'u1', role: 'ADMIN' } } as unknown as Request;
        const res = { ok: jest.fn() } as unknown as Response;
        const getSpy = jest.spyOn(billingService, 'getInvoiceById');

        await expect(billingController.getInvoiceById(req, res)).rejects.toMatchObject({
            status: 400,
            message: 'Identificador de fatura invalido.',
        });
        expect(getSpy).not.toHaveBeenCalled();
    });

    it('bloqueia session id invalido em sessions.getById', async () => {
        const req = { params: { id: 'abc' }, auth: { userId: 'u1', role: 'ADMIN' } } as unknown as Request;
        const res = { ok: jest.fn() } as unknown as Response;
        const getSpy = jest.spyOn(sessionsService, 'getSessionById');

        await expect(sessionsController.getById(req, res)).rejects.toMatchObject({
            status: 400,
            message: 'Identificador de sessao invalido.',
        });
        expect(getSpy).not.toHaveBeenCalled();
    });

    it('bloqueia reservation id invalido em reservations.checkin', async () => {
        const req = { params: { id: 'abc' }, auth: { userId: 'u1', role: 'ADMIN' } } as unknown as Request;
        const res = { ok: jest.fn() } as unknown as Response;
        const checkinSpy = jest.spyOn(sessionsService, 'checkinReservation');
        const listSpy = jest.spyOn(reservationsService, 'list');

        await expect(reservationsController.checkin(req, res)).rejects.toMatchObject({
            status: 400,
            message: 'Identificador de reserva invalido.',
        });
        expect(checkinSpy).not.toHaveBeenCalled();
        expect(listSpy).not.toHaveBeenCalled();
    });
});

