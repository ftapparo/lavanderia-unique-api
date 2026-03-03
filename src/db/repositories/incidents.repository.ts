import { db } from '../pool';
import type { IncidentRecord, IncidentType, IncidentView } from '../../types/domain.types';

export const incidentsRepository = {
    async create(input: {
        type: IncidentType;
        description: string;
        reservationId?: string | null;
        laundrySessionId?: string | null;
        unitId?: string | null;
        userId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<IncidentRecord> {
        const result = await db.query<IncidentRecord>(
            `INSERT INTO incidents (
                type,
                reservation_id,
                laundry_session_id,
                unit_id,
                user_id,
                description,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, type, reservation_id, laundry_session_id, unit_id, user_id, description, metadata, created_at`,
            [
                input.type,
                input.reservationId ?? null,
                input.laundrySessionId ?? null,
                input.unitId ?? null,
                input.userId ?? null,
                input.description,
                input.metadata ?? {},
            ],
        );

        return result.rows[0];
    },

    async listAll(limit = 500): Promise<IncidentView[]> {
        const result = await db.query<IncidentView>(
            `SELECT i.id,
                    i.type,
                    i.reservation_id AS "reservationId",
                    i.laundry_session_id AS "laundrySessionId",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.description,
                    i.metadata,
                    i.created_at AS "createdAt"
             FROM incidents i
             LEFT JOIN units u ON u.id = i.unit_id
             LEFT JOIN users us ON us.id = i.user_id
             ORDER BY i.created_at DESC
             LIMIT $1`,
            [limit],
        );

        return result.rows;
    },

    async listByUserId(userId: string, limit = 500): Promise<IncidentView[]> {
        const result = await db.query<IncidentView>(
            `SELECT i.id,
                    i.type,
                    i.reservation_id AS "reservationId",
                    i.laundry_session_id AS "laundrySessionId",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.description,
                    i.metadata,
                    i.created_at AS "createdAt"
             FROM incidents i
             LEFT JOIN units u ON u.id = i.unit_id
             LEFT JOIN users us ON us.id = i.user_id
             WHERE i.user_id = $1
             ORDER BY i.created_at DESC
             LIMIT $2`,
            [userId, limit],
        );

        return result.rows;
    },
};
