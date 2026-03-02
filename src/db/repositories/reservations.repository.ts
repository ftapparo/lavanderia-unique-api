import { db } from '../pool';
import type { ReservationRecord, ReservationView } from '../../types/domain.types';

export const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as const;

export const reservationsRepository = {
    async create(input: {
        unitId: string;
        machinePairId: string;
        userId: string;
        startAt: string;
        endAt: string;
        status?: 'PENDING' | 'CONFIRMED';
    }): Promise<ReservationRecord> {
        const result = await db.query<ReservationRecord>(
            `INSERT INTO reservations (unit_id, machine_pair_id, user_id, start_at, end_at, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, unit_id, machine_pair_id, user_id, start_at, end_at, status, canceled_at, canceled_by_user_id, created_at, updated_at`,
            [input.unitId, input.machinePairId, input.userId, input.startAt, input.endAt, input.status ?? 'CONFIRMED'],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<ReservationRecord | null> {
        const result = await db.query<ReservationRecord>(
            `SELECT id, unit_id, machine_pair_id, user_id, start_at, end_at, status, canceled_at, canceled_by_user_id, created_at, updated_at
             FROM reservations
             WHERE id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async cancel(id: string, canceledByUserId: string): Promise<ReservationRecord | null> {
        const result = await db.query<ReservationRecord>(
            `UPDATE reservations
             SET status = 'CANCELED',
                 canceled_at = NOW(),
                 canceled_by_user_id = $2,
                 updated_at = NOW()
             WHERE id = $1
               AND status <> 'CANCELED'
             RETURNING id, unit_id, machine_pair_id, user_id, start_at, end_at, status, canceled_at, canceled_by_user_id, created_at, updated_at`,
            [id, canceledByUserId],
        );

        return result.rows[0] || null;
    },

    async listAll(): Promise<ReservationView[]> {
        const result = await db.query<ReservationView>(
            `SELECT r.id,
                    r.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    r.machine_pair_id AS "machinePairId",
                    mp.name AS "machinePairName",
                    r.user_id AS "userId",
                    us.name AS "userName",
                    r.start_at AS "startAt",
                    r.end_at AS "endAt",
                    r.status,
                    r.canceled_at AS "canceledAt"
             FROM reservations r
             INNER JOIN units u ON u.id = r.unit_id
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             INNER JOIN users us ON us.id = r.user_id
             ORDER BY r.start_at DESC`,
            [],
        );

        return result.rows;
    },

    async listByUserId(userId: string): Promise<ReservationView[]> {
        const result = await db.query<ReservationView>(
            `SELECT r.id,
                    r.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    r.machine_pair_id AS "machinePairId",
                    mp.name AS "machinePairName",
                    r.user_id AS "userId",
                    us.name AS "userName",
                    r.start_at AS "startAt",
                    r.end_at AS "endAt",
                    r.status,
                    r.canceled_at AS "canceledAt"
             FROM reservations r
             INNER JOIN units u ON u.id = r.unit_id
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             INNER JOIN users us ON us.id = r.user_id
             WHERE r.user_id = $1
             ORDER BY r.start_at DESC`,
            [userId],
        );

        return result.rows;
    },
};
