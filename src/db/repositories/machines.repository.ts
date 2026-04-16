import { db } from '../pool';
import type { MachineRecord, MachineStatus, MachineType, MachineView } from '../../types/domain.types';

export const machinesRepository = {
    async findById(id: string): Promise<MachineRecord | null> {
        const result = await db.query<MachineRecord>(
            `SELECT id, number, brand, model, name, type, tuya_device_id, active, status, created_at, updated_at
             FROM machines
             WHERE id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async create(input: {
        number: number;
        brand: string;
        model: string;
        name: string;
        type: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }): Promise<MachineRecord> {
        const result = await db.query<MachineRecord>(
            `INSERT INTO machines (number, brand, model, name, type, tuya_device_id, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, number, brand, model, name, type, tuya_device_id, active, status, created_at, updated_at`,
            [input.number, input.brand, input.model, input.name, input.type, input.tuyaDeviceId ?? null, input.active ?? true],
        );

        return result.rows[0];
    },

    async findViewById(id: string): Promise<MachineView | null> {
        const result = await db.query<MachineView>(
            `SELECT m.id,
                    m.number,
                    m.brand,
                    m.model,
                    m.name,
                    m.type,
                    m.tuya_device_id AS "tuyaDeviceId",
                    m.active,
                    m.status
             FROM machines m
             WHERE m.id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async update(id: string, input: {
        number?: number;
        brand?: string;
        model?: string;
        name?: string;
        type?: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }): Promise<MachineRecord | null> {
        const result = await db.query<MachineRecord>(
            `UPDATE machines
             SET number = COALESCE($2, number),
                 brand = COALESCE($3, brand),
                 model = COALESCE($4, model),
                 name = COALESCE($5, name),
                 type = COALESCE($6, type),
                 tuya_device_id = $7,
                 active = COALESCE($8, active),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, number, brand, model, name, type, tuya_device_id, active, status, created_at, updated_at`,
            [id, input.number ?? null, input.brand ?? null, input.model ?? null, input.name ?? null, input.type ?? null, input.tuyaDeviceId ?? null, input.active ?? null],
        );

        return result.rows[0] || null;
    },

    async setStatus(id: string, status: MachineStatus): Promise<MachineRecord | null> {
        const result = await db.query<MachineRecord>(
            `UPDATE machines
             SET status = $2::machine_status,
                 active = CASE WHEN $2::machine_status = 'ACTIVE' THEN true ELSE false END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, number, brand, model, name, type, tuya_device_id, active, status, created_at, updated_at`,
            [id, status],
        );

        return result.rows[0] || null;
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await db.query<{ id: string }>(
            `DELETE FROM machines
             WHERE id = $1
             RETURNING id`,
            [id],
        );

        return Boolean(result.rows[0]);
    },

    async listAll(): Promise<MachineView[]> {
        const result = await db.query<MachineView>(
            `SELECT m.id,
                    m.number,
                    m.brand,
                    m.model,
                    m.name,
                    m.type,
                    m.tuya_device_id AS "tuyaDeviceId",
                    m.active,
                    m.status
             FROM machines m
             ORDER BY m.number`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<MachineView[]> {
        void userId;
        const result = await db.query<MachineView>(
            `SELECT m.id,
                    m.number,
                    m.brand,
                    m.model,
                    m.name,
                    m.type,
                    m.tuya_device_id AS "tuyaDeviceId",
                    m.active,
                    m.status
             FROM machines m
             ORDER BY m.number`,
            [],
        );

        return result.rows;
    },
};
