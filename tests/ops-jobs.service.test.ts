import { opsJobsService } from '../src/services/ops-jobs.service';
import { reservationsRepository } from '../src/db/repositories/reservations.repository';
import { incidentsRepository } from '../src/db/repositories/incidents.repository';

describe('ops-jobs.service', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('reexecuta no-show em falha transiente e conclui sem duplicar incidente', async () => {
        jest.spyOn(reservationsRepository, 'listNoShowCandidates').mockResolvedValue([
            {
                id: 'res-1',
                unit_id: 'unit-1',
                machine_pair_id: 'pair-1',
                user_id: 'user-1',
                start_at: '2026-03-03T10:00:00.000Z',
                end_at: '2026-03-03T12:00:00.000Z',
            },
        ]);

        const updateStatus = jest
            .spyOn(reservationsRepository, 'updateStatus')
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValue({
                id: 'res-1',
                unit_id: 'unit-1',
                machine_pair_id: 'pair-1',
                user_id: 'user-1',
                start_at: '2026-03-03T10:00:00.000Z',
                end_at: '2026-03-03T12:00:00.000Z',
                status: 'FINISHED',
                canceled_at: null,
                canceled_by_user_id: null,
                created_at: '2026-03-03T09:00:00.000Z',
                updated_at: '2026-03-03T09:00:00.000Z',
            });

        const createIncident = jest.spyOn(incidentsRepository, 'create').mockResolvedValue({
            id: 'inc-1',
            type: 'NO_SHOW',
            reservation_id: 'res-1',
            laundry_session_id: null,
            unit_id: 'unit-1',
            user_id: 'user-1',
            description: 'no-show',
            metadata: {},
            created_at: '2026-03-03T12:05:00.000Z',
        });

        await opsJobsService.runNoShowDetectorNow();

        expect(updateStatus).toHaveBeenCalledTimes(2);
        expect(createIncident).toHaveBeenCalledTimes(1);
    });

    it('evita processamento duplicado concorrente para a mesma reserva', async () => {
        jest.spyOn(reservationsRepository, 'listNoShowCandidates').mockResolvedValue([
            {
                id: 'res-dup',
                unit_id: 'unit-1',
                machine_pair_id: 'pair-1',
                user_id: 'user-1',
                start_at: '2026-03-03T10:00:00.000Z',
                end_at: '2026-03-03T12:00:00.000Z',
            },
        ]);

        let resolveUpdate: (() => void) | undefined;
        const firstUpdate = new Promise<any>((resolve) => {
            resolveUpdate = () => resolve({
                id: 'res-dup',
                unit_id: 'unit-1',
                machine_pair_id: 'pair-1',
                user_id: 'user-1',
                start_at: '2026-03-03T10:00:00.000Z',
                end_at: '2026-03-03T12:00:00.000Z',
                status: 'FINISHED',
                canceled_at: null,
                canceled_by_user_id: null,
                created_at: '2026-03-03T09:00:00.000Z',
                updated_at: '2026-03-03T09:00:00.000Z',
            });
        });

        const updateStatus = jest.spyOn(reservationsRepository, 'updateStatus').mockImplementation(() => firstUpdate);
        const createIncident = jest.spyOn(incidentsRepository, 'create').mockResolvedValue({
            id: 'inc-2',
            type: 'NO_SHOW',
            reservation_id: 'res-dup',
            laundry_session_id: null,
            unit_id: 'unit-1',
            user_id: 'user-1',
            description: 'no-show',
            metadata: {},
            created_at: '2026-03-03T12:05:00.000Z',
        });

        const run1 = opsJobsService.runNoShowDetectorNow();
        const run2 = opsJobsService.runNoShowDetectorNow();

        await Promise.resolve();
        expect(updateStatus).toHaveBeenCalledTimes(1);
        if (resolveUpdate) {
            resolveUpdate();
        }
        await Promise.all([run1, run2]);

        expect(updateStatus).toHaveBeenCalledTimes(1);
        expect(createIncident).toHaveBeenCalledTimes(1);
    });
});
