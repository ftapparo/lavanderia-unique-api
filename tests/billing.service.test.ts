import { db } from '../src/db/pool';
import { invoicesRepository } from '../src/db/repositories/invoices.repository';
import { membershipsRepository } from '../src/db/repositories/memberships.repository';
import { reservationsRepository } from '../src/db/repositories/reservations.repository';
import { systemSettingsRepository } from '../src/db/repositories/system-settings.repository';
import { billingService } from '../src/services/billing.service';

describe('billing.service', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        process.env.BILLING_REPORT_TO = '';
    });

    it('aplica configuracao vigente por evento e marca fatura como MIXED', async () => {
        const nowIso = new Date().toISOString();
        const oldStart = '2026-03-05T10:00:00.000Z';
        const newStart = '2026-03-20T10:00:00.000Z';

        jest.spyOn(reservationsRepository, 'listFinishedByCompetence').mockResolvedValue([
            {
                reservationId: 'res-1',
                userId: 'user-1',
                unitId: 'unit-1',
                startAt: oldStart,
                machinePairName: 'Par A',
                laundrySessionId: null,
            },
            {
                reservationId: 'res-2',
                userId: 'user-1',
                unitId: 'unit-1',
                startAt: newStart,
                machinePairName: 'Par A',
                laundrySessionId: 'sess-2',
            },
        ]);

        jest.spyOn(db, 'query').mockResolvedValue({
            rows: [
                { laundrySessionId: 'sess-2', totalEnergyKwh: '4.0' },
            ],
        } as any);

        jest.spyOn(systemSettingsRepository, 'getAsOf').mockImplementation(async (dateTimeIso: string) => {
            if (dateTimeIso === oldStart) {
                return {
                    checkinWindowBeforeMinutes: 15,
                    checkinWindowAfterMinutes: 30,
                    reservationDurationHours: 2,
                    reservationStartMode: 'FULL_HOUR',
                    overtimeThresholdWatts: 15,
                    consumptionPollSeconds: 30,
                    billingMode: 'PER_USE',
                    pricePerUse: 7,
                    pricePerKwh: 0,
                    updatedByUserId: null,
                    updatedAt: nowIso,
                };
            }

            return {
                checkinWindowBeforeMinutes: 15,
                checkinWindowAfterMinutes: 30,
                reservationDurationHours: 2,
                reservationStartMode: 'FULL_HOUR',
                overtimeThresholdWatts: 15,
                consumptionPollSeconds: 30,
                billingMode: 'PER_KWH',
                pricePerUse: 7,
                pricePerKwh: 2.5,
                updatedByUserId: null,
                updatedAt: nowIso,
            };
        });

        jest.spyOn(membershipsRepository, 'findBillingResponsibleUserByUnitOnDate').mockResolvedValue(null);
        jest.spyOn(invoicesRepository, 'deleteByCompetence').mockResolvedValue(undefined);
        jest.spyOn(invoicesRepository, 'create').mockResolvedValue({
            id: 'inv-1',
            competence: '2026-03',
            user_id: 'user-1',
            unit_id: 'unit-1',
            billing_mode: 'MIXED',
            total_amount: '17.00',
            generated_at: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
        });
        const createItem = jest.spyOn(invoicesRepository, 'createItem').mockResolvedValue(undefined);

        const client = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        jest.spyOn(db, 'connect').mockResolvedValue(client as any);

        const result = await billingService.run({ competence: '2026-03' });

        expect(result.billingMode).toBe('MIXED');
        expect(result.totalAmount).toBe(17);
        expect(invoicesRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            billingMode: 'MIXED',
            totalAmount: 17,
        }), client as any);
        expect(createItem).toHaveBeenCalledTimes(2);
        expect(createItem).toHaveBeenNthCalledWith(1, expect.objectContaining({
            quantity: 1,
            unitPrice: 7,
            totalAmount: 7,
            metadata: expect.objectContaining({ billingMode: 'PER_USE' }),
        }), client as any);
        expect(createItem).toHaveBeenNthCalledWith(2, expect.objectContaining({
            quantity: 4,
            unitPrice: 2.5,
            totalAmount: 10,
            metadata: expect.objectContaining({ billingMode: 'PER_KWH' }),
        }), client as any);
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith('COMMIT');
    });
});
