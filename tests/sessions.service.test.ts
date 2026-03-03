import { auditLogsRepository } from '../src/db/repositories/audit-logs.repository';
import { laundrySessionsRepository } from '../src/db/repositories/laundry-sessions.repository';
import { machinePairsRepository } from '../src/db/repositories/machine-pairs.repository';
import { machinesRepository } from '../src/db/repositories/machines.repository';
import { reservationsRepository } from '../src/db/repositories/reservations.repository';
import { systemSettingsRepository } from '../src/db/repositories/system-settings.repository';
import { tuyaCommandLogsRepository } from '../src/db/repositories/tuya-command-logs.repository';
import { tuyaClient } from '../src/integrations/tuya/tuya-client';
import { sessionsService } from '../src/services/sessions.service';

describe('sessions.service', () => {
    const reservationId = 'res-1';
    const userId = 'user-1';
    const pairId = 'pair-1';
    const washerId = 'washer-1';
    const dryerId = 'dryer-1';

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('blocks checkin when outside allowed window', async () => {
        jest.spyOn(systemSettingsRepository, 'get').mockResolvedValue({
            checkinWindowBeforeMinutes: 15,
            checkinWindowAfterMinutes: 30,
            overtimeThresholdWatts: 15,
            consumptionPollSeconds: 30,
            billingMode: 'PER_USE',
            pricePerUse: 12,
            pricePerKwh: 2.5,
            updatedByUserId: null,
            updatedAt: new Date().toISOString(),
        });
        jest.spyOn(reservationsRepository, 'findById').mockResolvedValue({
            id: reservationId,
            unit_id: 'unit-1',
            machine_pair_id: pairId,
            user_id: userId,
            start_at: '2000-01-01T00:00:00.000Z',
            end_at: '2000-01-01T02:00:00.000Z',
            status: 'CONFIRMED',
            canceled_at: null,
            canceled_by_user_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        await expect(sessionsService.checkinReservation(reservationId, userId, false)).rejects.toMatchObject({ status: 409 });
    });

    it('starts session and turns on pair devices on valid checkin', async () => {
        const now = new Date();
        const startAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
        const endAt = new Date(now.getTime() + (2 * 60 * 60 * 1000)).toISOString();
        jest.spyOn(systemSettingsRepository, 'get').mockResolvedValue({
            checkinWindowBeforeMinutes: 15,
            checkinWindowAfterMinutes: 30,
            overtimeThresholdWatts: 15,
            consumptionPollSeconds: 30,
            billingMode: 'PER_USE',
            pricePerUse: 12,
            pricePerKwh: 2.5,
            updatedByUserId: null,
            updatedAt: new Date().toISOString(),
        });

        jest.spyOn(reservationsRepository, 'findById').mockResolvedValue({
            id: reservationId,
            unit_id: 'unit-1',
            machine_pair_id: pairId,
            user_id: userId,
            start_at: startAt,
            end_at: endAt,
            status: 'CONFIRMED',
            canceled_at: null,
            canceled_by_user_id: null,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });

        jest.spyOn(machinePairsRepository, 'findById').mockResolvedValue({
            id: pairId,
            name: 'Par 01',
            washer_machine_id: washerId,
            dryer_machine_id: dryerId,
            active: true,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });

        jest.spyOn(machinesRepository, 'findById').mockImplementation(async (id: string) => {
            if (id === washerId) {
                return {
                    id: washerId,
                    number: 1,
                    brand: 'Brand',
                    model: 'Model',
                    name: 'Lavadora 1',
                    type: 'WASHER',
                    tuya_device_id: 'tuya-w-1',
                    active: true,
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                };
            }
            if (id === dryerId) {
                return {
                    id: dryerId,
                    number: 2,
                    brand: 'Brand',
                    model: 'Model',
                    name: 'Secadora 1',
                    type: 'DRYER',
                    tuya_device_id: 'tuya-d-1',
                    active: true,
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                };
            }
            return null;
        });

        jest.spyOn(laundrySessionsRepository, 'findByReservationId').mockResolvedValue(null);
        jest.spyOn(laundrySessionsRepository, 'create').mockResolvedValue({
            id: 'sess-1',
            reservation_id: reservationId,
            unit_id: 'unit-1',
            machine_pair_id: pairId,
            user_id: userId,
            checkin_at: now.toISOString(),
            started_at: now.toISOString(),
            finished_at: null,
            status: 'ACTIVE',
            overtime_started_at: null,
            overtime_ended_at: null,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });
        jest.spyOn(laundrySessionsRepository, 'findViewById').mockResolvedValue({
            id: 'sess-1',
            reservationId,
            reservationStartAt: startAt,
            reservationEndAt: endAt,
            unitId: 'unit-1',
            unitName: '101',
            unitCode: '1',
            machinePairId: pairId,
            machinePairName: 'Par 01',
            userId,
            userName: 'Morador 1',
            checkinAt: now.toISOString(),
            startedAt: now.toISOString(),
            finishedAt: null,
            status: 'ACTIVE',
            overtimeStartedAt: null,
            overtimeEndedAt: null,
        });

        jest.spyOn(tuyaClient, 'turnOn').mockResolvedValue({
            deviceId: 'tuya-any',
            command: 'TURN_ON',
            mocked: true,
        });
        jest.spyOn(tuyaCommandLogsRepository, 'create').mockResolvedValue({
            id: 'log-1',
            laundry_session_id: 'sess-1',
            reservation_id: reservationId,
            machine_id: washerId,
            device_id: 'tuya-w-1',
            command: 'TURN_ON',
            success: true,
            request_payload: {},
            response_payload: {},
            error_message: null,
            created_at: now.toISOString(),
        });
        jest.spyOn(reservationsRepository, 'updateStatus').mockResolvedValue({
            id: reservationId,
            unit_id: 'unit-1',
            machine_pair_id: pairId,
            user_id: userId,
            start_at: startAt,
            end_at: endAt,
            status: 'IN_PROGRESS',
            canceled_at: null,
            canceled_by_user_id: null,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });
        jest.spyOn(auditLogsRepository, 'add').mockResolvedValue(undefined);

        const session = await sessionsService.checkinReservation(reservationId, userId, false);

        expect(session.id).toBe('sess-1');
        expect(tuyaClient.turnOn).toHaveBeenCalledTimes(2);
        expect(reservationsRepository.updateStatus).toHaveBeenCalledWith(reservationId, 'IN_PROGRESS');
    });
});
