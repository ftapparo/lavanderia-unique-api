import { db } from '../pool';
import type { UnitRecord, UnitView } from '../../types/domain.types';

export const unitsRepository = {
    async create(input: { name: string; floor: number; unitNumber: number; active: boolean; allowGuestReservations?: boolean }): Promise<UnitRecord> {
        const result = await db.query<UnitRecord>(
            `INSERT INTO units (name, code, floor, unit_number, active, allow_guest_reservations)
             VALUES ($1, nextval('units_code_seq')::TEXT, $2, $3, $4, $5)
             RETURNING id, name, code, floor, unit_number, active, allow_guest_reservations, created_at, updated_at`,
            [input.name, input.floor, input.unitNumber, input.active, input.allowGuestReservations ?? true],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<UnitRecord | null> {
        const result = await db.query<UnitRecord>(
            `SELECT id, name, code, floor, unit_number, active, allow_guest_reservations, created_at, updated_at FROM units WHERE id = $1 LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async update(id: string, input: { name?: string; floor?: number; unitNumber?: number; active?: boolean; allowGuestReservations?: boolean }): Promise<UnitRecord | null> {
        const result = await db.query<UnitRecord>(
            `UPDATE units
             SET name = COALESCE($2, name),
                 floor = COALESCE($3, floor),
                 unit_number = COALESCE($4, unit_number),
                 active = COALESCE($5, active),
                 allow_guest_reservations = COALESCE($6, allow_guest_reservations),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, code, floor, unit_number, active, allow_guest_reservations, created_at, updated_at`,
            [id, input.name ?? null, input.floor ?? null, input.unitNumber ?? null, input.active ?? null, input.allowGuestReservations ?? null],
        );

        return result.rows[0] || null;
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await db.query<{ id: string }>(
            `DELETE FROM units
             WHERE id = $1
             RETURNING id`,
            [id],
        );

        return Boolean(result.rows[0]);
    },

    async listAll(): Promise<UnitView[]> {
        const result = await db.query<UnitView>(
            `SELECT id, name, code, floor, unit_number AS "unitNumber", active, allow_guest_reservations AS "allowGuestReservations"
             FROM units
             ORDER BY
                CASE WHEN code ~ '^[0-9]+$' THEN code::BIGINT ELSE 9223372036854775807 END,
                code`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<UnitView[]> {
        const result = await db.query<UnitView>(
            `SELECT t.id, t.name, t.code, t.floor, t."unitNumber", t.active, t."allowGuestReservations"
             FROM (
                SELECT DISTINCT u.id, u.name, u.code, u.floor, u.unit_number AS "unitNumber", u.active, u.allow_guest_reservations AS "allowGuestReservations"
                FROM units u
                INNER JOIN unit_memberships m ON m.unit_id = u.id
                WHERE m.user_id = $1
                  AND u.active = true
                  AND m.active = true
                  AND m.start_date <= CURRENT_DATE
                  AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
                  AND (
                    m.profile <> 'PROPRIETARIO'
                    OR NOT EXISTS (
                      SELECT 1
                      FROM unit_memberships tenant
                      WHERE tenant.unit_id = u.id
                        AND tenant.profile = 'LOCATARIO'
                        AND tenant.active = true
                        AND tenant.start_date <= CURRENT_DATE
                        AND (tenant.end_date IS NULL OR tenant.end_date >= CURRENT_DATE)
                    )
                  )
             ) t
             ORDER BY
                CASE WHEN t.code ~ '^[0-9]+$' THEN t.code::BIGINT ELSE 9223372036854775807 END,
                t.code`,
            [userId],
        );

        return result.rows;
    },
};
