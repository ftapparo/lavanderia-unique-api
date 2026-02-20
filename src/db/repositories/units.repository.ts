import { db } from '../pool';
import type { UnitRecord, UnitView } from '../../types/domain.types';

export const unitsRepository = {
    async create(name: string, code: string): Promise<UnitRecord> {
        const result = await db.query<UnitRecord>(
            `INSERT INTO units (name, code)
             VALUES ($1, $2)
             RETURNING id, name, code, created_at, updated_at`,
            [name, code],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<UnitRecord | null> {
        const result = await db.query<UnitRecord>(
            `SELECT id, name, code, created_at, updated_at FROM units WHERE id = $1 LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async listAll(): Promise<UnitView[]> {
        const result = await db.query<UnitView>(
            `SELECT id, name, code FROM units ORDER BY code`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<UnitView[]> {
        const result = await db.query<UnitView>(
            `SELECT DISTINCT u.id, u.name, u.code
             FROM units u
             INNER JOIN unit_memberships m ON m.unit_id = u.id
             WHERE m.user_id = $1
               AND m.active = true
               AND m.start_date <= CURRENT_DATE
               AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
             ORDER BY u.code`,
            [userId],
        );

        return result.rows;
    },
};
