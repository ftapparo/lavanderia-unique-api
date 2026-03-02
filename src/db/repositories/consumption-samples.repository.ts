import { db } from '../pool';
import type { ConsumptionSampleRecord } from '../../types/domain.types';

export const consumptionSamplesRepository = {
    async create(input: {
        laundrySessionId: string;
        machineId: string;
        sampleAt: string;
        powerWatts: number;
        energyKwh: number;
    }): Promise<ConsumptionSampleRecord> {
        const result = await db.query<ConsumptionSampleRecord>(
            `INSERT INTO consumption_samples (laundry_session_id, machine_id, sample_at, power_watts, energy_kwh)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, laundry_session_id, machine_id, sample_at, power_watts, energy_kwh, created_at`,
            [input.laundrySessionId, input.machineId, input.sampleAt, input.powerWatts, input.energyKwh],
        );

        return result.rows[0];
    },
};
