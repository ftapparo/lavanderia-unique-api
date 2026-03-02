import { db } from '../pool';
import type { MachinePairRecord, MachinePairView } from '../../types/domain.types';

export const machinePairsRepository = {
    async create(input: {
        name: string;
        washerMachineId: string;
        dryerMachineId: string;
        active?: boolean;
    }): Promise<MachinePairRecord> {
        const result = await db.query<MachinePairRecord>(
            `INSERT INTO machine_pairs (name, washer_machine_id, dryer_machine_id, active)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, washer_machine_id, dryer_machine_id, active, created_at, updated_at`,
            [input.name, input.washerMachineId, input.dryerMachineId, input.active ?? true],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<MachinePairRecord | null> {
        const result = await db.query<MachinePairRecord>(
            `SELECT id, name, washer_machine_id, dryer_machine_id, active, created_at, updated_at
             FROM machine_pairs
             WHERE id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async listAll(): Promise<MachinePairView[]> {
        const result = await db.query<MachinePairView>(
            `SELECT mp.id,
                    mp.name,
                    mp.washer_machine_id AS "washerMachineId",
                    mw.name AS "washerMachineName",
                    mp.dryer_machine_id AS "dryerMachineId",
                    md.name AS "dryerMachineName",
                    mp.active
             FROM machine_pairs mp
             INNER JOIN machines mw ON mw.id = mp.washer_machine_id
             INNER JOIN machines md ON md.id = mp.dryer_machine_id
             ORDER BY mp.name`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<MachinePairView[]> {
        void userId;
        const result = await db.query<MachinePairView>(
            `SELECT mp.id,
                    mp.name,
                    mp.washer_machine_id AS "washerMachineId",
                    mw.name AS "washerMachineName",
                    mp.dryer_machine_id AS "dryerMachineId",
                    md.name AS "dryerMachineName",
                    mp.active
             FROM machine_pairs mp
             INNER JOIN machines mw ON mw.id = mp.washer_machine_id
             INNER JOIN machines md ON md.id = mp.dryer_machine_id
             ORDER BY mp.name`,
            [],
        );

        return result.rows;
    },
};
