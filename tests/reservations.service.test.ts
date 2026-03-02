import { reservationsService } from '../src/services/reservations.service';
import { machinePairsRepository } from '../src/db/repositories/machine-pairs.repository';
import { membershipsRepository } from '../src/db/repositories/memberships.repository';
import { reservationsRepository } from '../src/db/repositories/reservations.repository';
import { auditLogsRepository } from '../src/db/repositories/audit-logs.repository';

describe('reservations.service', () => {
    const userId = 'user-1';
    const pairId = 'pair-1';
    const unitId = 'unit-1';

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('creates reservation with fixed 2h duration', async () => {
        const startAt = '2026-03-03T10:00:00.000Z';

        jest.spyOn(machinePairsRepository, 'findById').mockResolvedValue({
            id: pairId,
            unit_id: unitId,
            name: 'Par A',
            washer_machine_id: 'm-w-1',
            dryer_machine_id: 'm-d-1',
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        jest.spyOn(membershipsRepository, 'findActiveByUserAndUnitOnDate').mockResolvedValue({
            id: 'mem-1',
            user_id: userId,
            unit_id: unitId,
            profile: 'MORADOR',
            start_date: '2026-01-01',
            end_date: null,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        const createSpy = jest.spyOn(reservationsRepository, 'create').mockResolvedValue({
            id: 'res-1',
            unit_id: unitId,
            machine_pair_id: pairId,
            user_id: userId,
            start_at: startAt,
            end_at: '2026-03-03T12:00:00.000Z',
            status: 'CONFIRMED',
            canceled_at: null,
            canceled_by_user_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        jest.spyOn(auditLogsRepository, 'add').mockResolvedValue(undefined);

        const result = await reservationsService.create({ machinePairId: pairId, startAt }, userId);

        expect(result.id).toBe('res-1');
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
            machinePairId: pairId,
            unitId,
            userId,
            startAt,
            endAt: '2026-03-03T12:00:00.000Z',
            status: 'CONFIRMED',
        }));
    });

    it('blocks creation when user has no active membership', async () => {
        jest.spyOn(machinePairsRepository, 'findById').mockResolvedValue({
            id: pairId,
            unit_id: unitId,
            name: 'Par A',
            washer_machine_id: 'm-w-1',
            dryer_machine_id: 'm-d-1',
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        jest.spyOn(membershipsRepository, 'findActiveByUserAndUnitOnDate').mockResolvedValue(null);

        await expect(reservationsService.create({
            machinePairId: pairId,
            startAt: '2026-03-03T10:00:00.000Z',
        }, userId)).rejects.toMatchObject({ status: 403 });
    });

    it('maps overlap conflict to 409', async () => {
        jest.spyOn(machinePairsRepository, 'findById').mockResolvedValue({
            id: pairId,
            unit_id: unitId,
            name: 'Par A',
            washer_machine_id: 'm-w-1',
            dryer_machine_id: 'm-d-1',
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        jest.spyOn(membershipsRepository, 'findActiveByUserAndUnitOnDate').mockResolvedValue({
            id: 'mem-1',
            user_id: userId,
            unit_id: unitId,
            profile: 'MORADOR',
            start_date: '2026-01-01',
            end_date: null,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        jest.spyOn(reservationsRepository, 'create').mockRejectedValue({ code: '23P01' });

        await expect(reservationsService.create({
            machinePairId: pairId,
            startAt: '2026-03-03T10:00:00.000Z',
        }, userId)).rejects.toMatchObject({ status: 409 });
    });

    it('blocks cancel by non-owner non-admin', async () => {
        jest.spyOn(reservationsRepository, 'findById').mockResolvedValue({
            id: 'res-1',
            unit_id: unitId,
            machine_pair_id: pairId,
            user_id: 'owner-user',
            start_at: '2026-03-03T10:00:00.000Z',
            end_at: '2026-03-03T12:00:00.000Z',
            status: 'CONFIRMED',
            canceled_at: null,
            canceled_by_user_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        await expect(reservationsService.cancel('res-1', userId, false)).rejects.toMatchObject({ status: 403 });
    });
});
