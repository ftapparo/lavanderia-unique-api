import { db } from '../pool';
import type { MembershipProfileView, MembershipView, UnitMembershipRecord } from '../../types/domain.types';

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
    async listProfiles(): Promise<MembershipProfileView[]> {
        const result = await db.query<MembershipProfileView>(
            `SELECT code, name, description
             FROM membership_profiles
             ORDER BY code ASC`,
            [],
        );
        return result.rows;
    },

    async profileExists(profileCode: string): Promise<boolean> {
        const result = await db.query<{ code: string }>(
            `SELECT code FROM membership_profiles WHERE code = $1 LIMIT 1`,
            [profileCode],
        );
        return Boolean(result.rows[0]);
    },

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
        const membership = result.rows[0] || null;
        if (!membership) {
            return null;
        }

        if (membership.profile === 'PROPRIETARIO') {
            const tenant = await db.query<{ id: string }>(
                `SELECT id
                 FROM unit_memberships
                 WHERE unit_id = $1
                   AND profile = 'LOCATARIO'
                   AND active = true
                   AND start_date <= $2::date
                   AND (end_date IS NULL OR end_date >= $2::date)
                 LIMIT 1`,
                [unitId, dateIso],
            );

            if (tenant.rows[0]) {
                return null;
            }
        }

        return membership;
    },

    async hasOverlappingLocatarioForUser(input: {
        userId: string;
        unitId: string;
        startDate: string;
        endDate?: string | null;
        excludeMembershipId?: string;
    }): Promise<boolean> {
        const result = await db.query<{ id: string }>(
            `SELECT id
             FROM unit_memberships
             WHERE user_id = $1
               AND profile = 'LOCATARIO'
               AND active = true
               AND unit_id <> $2
               AND ($3::date <= COALESCE(end_date, '9999-12-31'::date))
               AND (COALESCE($4::date, '9999-12-31'::date) >= start_date)
               AND ($5::uuid IS NULL OR id <> $5::uuid)
             LIMIT 1`,
            [input.userId, input.unitId, input.startDate, input.endDate ?? null, input.excludeMembershipId ?? null],
        );

        return Boolean(result.rows[0]);
    },

    async hasAnyProfileByUserAndUnitOnDate(input: {
        userId: string;
        unitId: string;
        dateIso: string;
        profiles: string[];
    }): Promise<boolean> {
        const result = await db.query<{ id: string }>(
            `SELECT id
             FROM unit_memberships
             WHERE user_id = $1
               AND unit_id = $2
               AND active = true
               AND profile = ANY($3::text[])
               AND start_date <= $4::date
               AND (end_date IS NULL OR end_date >= $4::date)
             LIMIT 1`,
            [input.userId, input.unitId, input.profiles, input.dateIso],
        );

        return Boolean(result.rows[0]);
    },

    async findBillingResponsibleUserByUnitOnDate(unitId: string, dateIso: string): Promise<string | null> {
        const result = await db.query<{ user_id: string }>(
            `SELECT user_id
             FROM unit_memberships
             WHERE unit_id = $1
               AND active = true
               AND profile IN ('LOCATARIO', 'PROPRIETARIO', 'ADMINISTRADOR', 'SUPER')
               AND start_date <= $2::date
               AND (end_date IS NULL OR end_date >= $2::date)
             ORDER BY CASE profile
                 WHEN 'LOCATARIO' THEN 1
                 WHEN 'PROPRIETARIO' THEN 2
                 WHEN 'ADMINISTRADOR' THEN 3
                 WHEN 'SUPER' THEN 4
                 ELSE 99
             END,
             start_date DESC
             LIMIT 1`,
            [unitId, dateIso],
        );

        return result.rows[0]?.user_id || null;
    },

    async listAccessibleUnitIdsByUserOnDate(userId: string, dateIso: string): Promise<string[]> {
        const result = await db.query<{ unit_id: string }>(
            `SELECT DISTINCT um.unit_id
             FROM unit_memberships um
             WHERE um.user_id = $1
               AND um.active = true
               AND um.start_date <= $2::date
               AND (um.end_date IS NULL OR um.end_date >= $2::date)
               AND (
                 um.profile <> 'PROPRIETARIO'
                 OR NOT EXISTS (
                   SELECT 1
                   FROM unit_memberships tenant
                   WHERE tenant.unit_id = um.unit_id
                     AND tenant.profile = 'LOCATARIO'
                     AND tenant.active = true
                     AND tenant.start_date <= $2::date
                     AND (tenant.end_date IS NULL OR tenant.end_date >= $2::date)
                 )
               )`,
            [userId, dateIso],
        );

        return result.rows.map((row) => row.unit_id);
    },
};
