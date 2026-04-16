import { db } from '../pool';
import type { ReservationBusyView, ReservationRecord, ReservationView } from '../../types/domain.types';

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

    async findByIdView(id: string): Promise<ReservationView | null> {
        const result = await db.query<ReservationView>(
            `SELECT r.id,
                    r.unit_id          AS "unitId",
                    u.name             AS "unitName",
                    u.code             AS "unitCode",
                    r.machine_pair_id  AS "machinePairId",
                    mp.name            AS "machinePairName",
                    r.user_id          AS "userId",
                    us.name            AS "userName",
                    r.start_at         AS "startAt",
                    r.end_at           AS "endAt",
                    r.status,
                    r.canceled_at      AS "canceledAt",
                    r.canceled_by_user_id AS "canceledByUserId",
                    cu.name            AS "canceledByUserName",
                    r.canceled_reason  AS "canceledReason"
             FROM reservations r
             INNER JOIN units u       ON u.id  = r.unit_id
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             INNER JOIN users us      ON us.id = r.user_id
             LEFT JOIN users cu       ON cu.id = r.canceled_by_user_id
             WHERE r.id = $1
             LIMIT 1`,
            [id],
        );
        return result.rows[0] || null;
    },

    async cancel(id: string, canceledByUserId: string, reason: 'USER' | 'ADMIN' | 'MAINTENANCE'): Promise<ReservationRecord | null> {
        const result = await db.query<ReservationRecord>(
            `UPDATE reservations
             SET status = 'CANCELED',
                 canceled_at = NOW(),
                 canceled_by_user_id = $2,
                 canceled_reason = $3,
                 updated_at = NOW()
             WHERE id = $1
               AND status <> 'CANCELED'
             RETURNING id, unit_id, machine_pair_id, user_id, start_at, end_at, status, canceled_at, canceled_by_user_id, canceled_reason, created_at, updated_at`,
            [id, canceledByUserId, reason],
        );

        return result.rows[0] || null;
    },

    async updateStatus(id: string, status: ReservationRecord['status']): Promise<ReservationRecord | null> {
        const result = await db.query<ReservationRecord>(
            `UPDATE reservations
             SET status = $2,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, unit_id, machine_pair_id, user_id, start_at, end_at, status, canceled_at, canceled_by_user_id, created_at, updated_at`,
            [id, status],
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
                    r.canceled_at AS "canceledAt",
                    r.canceled_by_user_id AS "canceledByUserId",
                    cu.name AS "canceledByUserName",
                    r.canceled_reason AS "canceledReason"
             FROM reservations r
             INNER JOIN units u ON u.id = r.unit_id
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             INNER JOIN users us ON us.id = r.user_id
             LEFT JOIN users cu ON cu.id = r.canceled_by_user_id
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

    async listByAccessibleUnits(userId: string): Promise<ReservationView[]> {
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
             WHERE EXISTS (
               SELECT 1
               FROM unit_memberships um
               WHERE um.user_id = $1
                 AND um.unit_id = r.unit_id
                 AND um.active = true
                 AND um.start_date <= CURRENT_DATE
                 AND (um.end_date IS NULL OR um.end_date >= CURRENT_DATE)
             )
             ORDER BY r.start_at DESC`,
            [userId],
        );

        return result.rows;
    },

    async feedByUser(input: {
        userId: string;
        cursor: string;   // ISO datetime — pivot
        direction: 'before' | 'after';
        limit: number;
        dateFilter?: string; // YYYY-MM-DD — restringe ao dia
    }): Promise<ReservationView[]> {
        const params: unknown[] = [input.userId, input.cursor, input.limit];
        const op    = input.direction === 'after' ? '>=' : '<';
        const order = input.direction === 'after' ? 'ASC' : 'DESC';
        let dateClause = '';
        if (input.dateFilter) {
            params.push(input.dateFilter);
            dateClause = `AND DATE(r.start_at AT TIME ZONE 'America/Sao_Paulo') = $${params.length}::date`;
        }

        const result = await db.query<ReservationView>(
            `SELECT r.id,
                    r.unit_id          AS "unitId",
                    u.name             AS "unitName",
                    u.code             AS "unitCode",
                    r.machine_pair_id  AS "machinePairId",
                    mp.name            AS "machinePairName",
                    r.user_id          AS "userId",
                    us.name            AS "userName",
                    r.start_at         AS "startAt",
                    r.end_at           AS "endAt",
                    r.status,
                    r.canceled_at      AS "canceledAt",
                    r.canceled_by_user_id AS "canceledByUserId",
                    cu.name            AS "canceledByUserName",
                    r.canceled_reason  AS "canceledReason"
             FROM reservations r
             INNER JOIN units u       ON u.id  = r.unit_id
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             INNER JOIN users us      ON us.id = r.user_id
             LEFT JOIN users cu       ON cu.id = r.canceled_by_user_id
             WHERE r.user_id = $1
               AND r.start_at ${op} $2
               ${dateClause}
             ORDER BY r.start_at ${order}
             LIMIT $3`,
            params,
        );

        // Normalise: before returns DESC from DB, reverse to get chronological order
        const rows = result.rows;
        return input.direction === 'before' ? rows.reverse() : rows;
    },

    async listBusy(): Promise<ReservationBusyView[]> {
        const result = await db.query<ReservationBusyView>(
            `SELECT r.id,
                    r.machine_pair_id AS "machinePairId",
                    r.start_at AS "startAt",
                    r.end_at AS "endAt",
                    r.status
             FROM reservations r
             WHERE r.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
             ORDER BY r.start_at DESC`,
            [],
        );

        return result.rows;
    },

    async listNoShowCandidates(nowIso: string): Promise<Array<{
        id: string;
        unit_id: string;
        user_id: string;
        machine_pair_id: string;
        start_at: string;
        end_at: string;
    }>> {
        const result = await db.query<{
            id: string;
            unit_id: string;
            user_id: string;
            machine_pair_id: string;
            start_at: string;
            end_at: string;
        }>(
            `SELECT r.id, r.unit_id, r.user_id, r.machine_pair_id, r.start_at, r.end_at
             FROM reservations r
             LEFT JOIN laundry_sessions ls ON ls.reservation_id = r.id
             WHERE r.status IN ('PENDING', 'CONFIRMED')
               AND r.end_at < $1
               AND ls.id IS NULL
             ORDER BY r.start_at ASC`,
            [nowIso],
        );

        return result.rows;
    },

    async listFinishedByCompetence(competence: string, chargeNoShow: boolean): Promise<Array<{
        reservationId: string;
        userId: string;
        unitId: string;
        startAt: string;
        machinePairName: string;
        laundrySessionId: string | null;
    }>> {
        const noShowFilter = chargeNoShow
            ? ''
            : `AND ls.id IS NOT NULL`;

        const result = await db.query<Array<{
            reservationId: string;
            userId: string;
            unitId: string;
            startAt: string;
            machinePairName: string;
            laundrySessionId: string | null;
        }>[number]>(
            `SELECT r.id AS "reservationId",
                    r.user_id AS "userId",
                    r.unit_id AS "unitId",
                    r.start_at AS "startAt",
                    mp.name AS "machinePairName",
                    ls.id AS "laundrySessionId"
             FROM reservations r
             INNER JOIN machine_pairs mp ON mp.id = r.machine_pair_id
             LEFT JOIN laundry_sessions ls ON ls.reservation_id = r.id
             WHERE r.status = 'FINISHED'
               AND to_char(r.start_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = $1
               ${noShowFilter}
             ORDER BY r.start_at ASC`,
            [competence],
        );

        return result.rows;
    },
};
