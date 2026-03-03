import { db } from '../pool';
import type { LaundrySessionRecord, LaundrySessionView } from '../../types/domain.types';

export const laundrySessionsRepository = {
    async create(input: {
        reservationId: string;
        unitId: string;
        machinePairId: string;
        userId: string;
        checkinAt: string;
        startedAt: string;
        status?: LaundrySessionRecord['status'];
    }): Promise<LaundrySessionRecord> {
        const result = await db.query<LaundrySessionRecord>(
            `INSERT INTO laundry_sessions (
                reservation_id,
                unit_id,
                machine_pair_id,
                user_id,
                checkin_at,
                started_at,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, reservation_id, unit_id, machine_pair_id, user_id, checkin_at, started_at, finished_at, status, overtime_started_at, overtime_ended_at, created_at, updated_at`,
            [
                input.reservationId,
                input.unitId,
                input.machinePairId,
                input.userId,
                input.checkinAt,
                input.startedAt,
                input.status ?? 'ACTIVE',
            ],
        );

        return result.rows[0];
    },

    async findByReservationId(reservationId: string): Promise<LaundrySessionRecord | null> {
        const result = await db.query<LaundrySessionRecord>(
            `SELECT id, reservation_id, unit_id, machine_pair_id, user_id, checkin_at, started_at, finished_at, status, overtime_started_at, overtime_ended_at, created_at, updated_at
             FROM laundry_sessions
             WHERE reservation_id = $1
             LIMIT 1`,
            [reservationId],
        );
        return result.rows[0] || null;
    },

    async findById(id: string): Promise<LaundrySessionRecord | null> {
        const result = await db.query<LaundrySessionRecord>(
            `SELECT id, reservation_id, unit_id, machine_pair_id, user_id, checkin_at, started_at, finished_at, status, overtime_started_at, overtime_ended_at, created_at, updated_at
             FROM laundry_sessions
             WHERE id = $1
             LIMIT 1`,
            [id],
        );
        return result.rows[0] || null;
    },

    async updateStatus(input: {
        id: string;
        status: LaundrySessionRecord['status'];
        finishedAt?: string | null;
    }): Promise<LaundrySessionRecord | null> {
        const result = await db.query<LaundrySessionRecord>(
            `UPDATE laundry_sessions
             SET status = $2,
                 finished_at = COALESCE($3, finished_at),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, reservation_id, unit_id, machine_pair_id, user_id, checkin_at, started_at, finished_at, status, overtime_started_at, overtime_ended_at, created_at, updated_at`,
            [input.id, input.status, input.finishedAt ?? null],
        );
        return result.rows[0] || null;
    },

    async findViewById(id: string): Promise<LaundrySessionView | null> {
        const result = await db.query<LaundrySessionView>(
            `SELECT ls.id,
                    ls.reservation_id AS "reservationId",
                    r.start_at AS "reservationStartAt",
                    r.end_at AS "reservationEndAt",
                    ls.unit_id AS "unitId",
                    u.name AS "unitName",
                    u.code AS "unitCode",
                    ls.machine_pair_id AS "machinePairId",
                    mp.name AS "machinePairName",
                    ls.user_id AS "userId",
                    us.name AS "userName",
                    ls.checkin_at AS "checkinAt",
                    ls.started_at AS "startedAt",
                    ls.finished_at AS "finishedAt",
                    ls.status,
                    ls.overtime_started_at AS "overtimeStartedAt",
                    ls.overtime_ended_at AS "overtimeEndedAt"
             FROM laundry_sessions ls
             INNER JOIN reservations r ON r.id = ls.reservation_id
             INNER JOIN units u ON u.id = ls.unit_id
             INNER JOIN machine_pairs mp ON mp.id = ls.machine_pair_id
             INNER JOIN users us ON us.id = ls.user_id
             WHERE ls.id = $1
             LIMIT 1`,
            [id],
        );
        return result.rows[0] || null;
    },

    async listActivePastReservationEnd(nowIso: string): Promise<Array<{
        id: string;
        reservationId: string;
        machinePairId: string;
        unitId: string;
        userId: string;
        overtimeStartedAt: string | null;
    }>> {
        const result = await db.query<Array<{
            id: string;
            reservationId: string;
            machinePairId: string;
            unitId: string;
            userId: string;
            overtimeStartedAt: string | null;
        }>[number]>(
            `SELECT ls.id,
                    ls.reservation_id AS "reservationId",
                    ls.machine_pair_id AS "machinePairId",
                    ls.unit_id AS "unitId",
                    ls.user_id AS "userId",
                    ls.overtime_started_at AS "overtimeStartedAt"
             FROM laundry_sessions ls
             INNER JOIN reservations r ON r.id = ls.reservation_id
             WHERE ls.status = 'ACTIVE'
               AND r.end_at <= $1
             ORDER BY r.end_at ASC`,
            [nowIso],
        );

        return result.rows;
    },

    async listActiveOvertimeSessions(): Promise<Array<{
        id: string;
        reservationId: string;
        machinePairId: string;
        unitId: string;
        userId: string;
        overtimeStartedAt: string;
    }>> {
        const result = await db.query<Array<{
            id: string;
            reservationId: string;
            machinePairId: string;
            unitId: string;
            userId: string;
            overtimeStartedAt: string;
        }>[number]>(
            `SELECT ls.id,
                    ls.reservation_id AS "reservationId",
                    ls.machine_pair_id AS "machinePairId",
                    ls.unit_id AS "unitId",
                    ls.user_id AS "userId",
                    ls.overtime_started_at AS "overtimeStartedAt"
             FROM laundry_sessions ls
             WHERE ls.status = 'ACTIVE'
               AND ls.overtime_started_at IS NOT NULL
             ORDER BY ls.overtime_started_at ASC`,
            [],
        );

        return result.rows;
    },

    async markOvertimeStarted(id: string, startedAtIso: string): Promise<void> {
        await db.query(
            `UPDATE laundry_sessions
             SET overtime_started_at = COALESCE(overtime_started_at, $2),
                 updated_at = NOW()
             WHERE id = $1`,
            [id, startedAtIso],
        );
    },

    async markOvertimeEnded(id: string, endedAtIso: string): Promise<void> {
        await db.query(
            `UPDATE laundry_sessions
             SET overtime_ended_at = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [id, endedAtIso],
        );
    },
};
