import { db } from '../pool';
import type { MembershipView, UnitMembershipRecord } from '../../types/domain.types';

type CreateMembershipInput = {
    userId: string;
    unitId: string;
    profile: string;
    startDate: string;
    endDate?: string | null;
    active?: boolean;
};

type UpdateMembershipInput = {
    profile?: string;
    startDate?: string;
    endDate?: string | null;
    active?: boolean;
};

export const membershipsRepository = {
    async create(input: CreateMembershipInput): Promise<UnitMembershipRecord> {
        const result = await db.query<UnitMembershipRecord>(
            `INSERT INTO unit_memberships (user_id, unit_id, profile, start_date, end_date, active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, user_id, unit_id, profile, start_date, end_date, active, created_at, updated_at`,
            [input.userId, input.unitId, input.profile, input.startDate, input.endDate ?? null, input.active ?? true],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<UnitMembershipRecord | null> {
        const result = await db.query<UnitMembershipRecord>(
            `SELECT id, user_id, unit_id, profile, start_date, end_date, active, created_at, updated_at
             FROM unit_memberships WHERE id = $1 LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async update(id: string, input: UpdateMembershipInput): Promise<UnitMembershipRecord | null> {
        const result = await db.query<UnitMembershipRecord>(
            `UPDATE unit_memberships
             SET profile = COALESCE($2, profile),
                 start_date = COALESCE($3, start_date),
                 end_date = $4,
                 active = COALESCE($5, active),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, user_id, unit_id, profile, start_date, end_date, active, created_at, updated_at`,
            [id, input.profile ?? null, input.startDate ?? null, input.endDate ?? null, input.active ?? null],
        );

        return result.rows[0] || null;
    },

    async listByUserId(userId: string): Promise<MembershipView[]> {
        const result = await db.query<MembershipView>(
            `SELECT m.id,
                    m.user_id AS "userId",
                    m.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    m.profile,
                    m.start_date AS "startDate",
                    m.end_date AS "endDate",
                    m.active
             FROM unit_memberships m
             INNER JOIN units u ON u.id = m.unit_id
             WHERE m.user_id = $1
             ORDER BY m.start_date DESC`,
            [userId],
        );

        return result.rows;
    },

    async listAll(): Promise<MembershipView[]> {
        const result = await db.query<MembershipView>(
            `SELECT m.id,
                    m.user_id AS "userId",
                    m.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    m.profile,
                    m.start_date AS "startDate",
                    m.end_date AS "endDate",
                    m.active
             FROM unit_memberships m
             INNER JOIN units u ON u.id = m.unit_id
             ORDER BY m.created_at DESC`,
            [],
        );

        return result.rows;
    },

    async findActiveByUserAndUnitOnDate(userId: string, unitId: string, dateIso: string): Promise<UnitMembershipRecord | null> {
        const result = await db.query<UnitMembershipRecord>(
            `SELECT id, user_id, unit_id, profile, start_date, end_date, active, created_at, updated_at
             FROM unit_memberships
             WHERE user_id = $1
               AND unit_id = $2
               AND active = true
               AND start_date <= $3::date
               AND (end_date IS NULL OR end_date >= $3::date)
             ORDER BY start_date DESC
             LIMIT 1`,
            [userId, unitId, dateIso],
        );

        return result.rows[0] || null;
    },
};
