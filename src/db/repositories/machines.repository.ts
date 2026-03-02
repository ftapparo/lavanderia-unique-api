import { db } from '../pool';
import type { MachineRecord, MachineType, MachineView } from '../../types/domain.types';

export const machinesRepository = {
    async findById(id: string): Promise<MachineRecord | null> {
        const result = await db.query<MachineRecord>(
            `SELECT id, unit_id, name, type, tuya_device_id, active, created_at, updated_at
             FROM machines
             WHERE id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async create(input: {
        unitId: string;
        name: string;
        type: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }): Promise<MachineRecord> {
        const result = await db.query<MachineRecord>(
            `INSERT INTO machines (unit_id, name, type, tuya_device_id, active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, unit_id, name, type, tuya_device_id, active, created_at, updated_at`,
            [input.unitId, input.name, input.type, input.tuyaDeviceId ?? null, input.active ?? true],
        );

        return result.rows[0];
    },

    async findViewById(id: string): Promise<MachineView | null> {
        const result = await db.query<MachineView>(
            `SELECT m.id,
                    m.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    m.name,
                    m.type,
                    m.active
             FROM machines m
             INNER JOIN units u ON u.id = m.unit_id
             WHERE m.id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async listAll(): Promise<MachineView[]> {
        const result = await db.query<MachineView>(
            `SELECT m.id,
                    m.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    m.name,
                    m.type,
                    m.active
             FROM machines m
             INNER JOIN units u ON u.id = m.unit_id
             ORDER BY u.code, m.type, m.name`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<MachineView[]> {
        const result = await db.query<MachineView>(
            `SELECT DISTINCT m.id,
                    m.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    m.name,
                    m.type,
                    m.active
             FROM machines m
             INNER JOIN units u ON u.id = m.unit_id
             INNER JOIN unit_memberships um ON um.unit_id = u.id
             WHERE um.user_id = $1
               AND um.active = true
               AND um.start_date <= CURRENT_DATE
               AND (um.end_date IS NULL OR um.end_date >= CURRENT_DATE)
             ORDER BY u.code, m.type, m.name`,
            [userId],
        );

        return result.rows;
    },
};
