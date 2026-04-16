import { db } from '../pool';
import type { MachineMaintenanceRecord, MachineMaintenanceView } from '../../types/domain.types';

export const machineMaintenancesRepository = {
    async create(input: {
        machineId: string;
        problem: string;
        startedAt?: string;
        createdByUserId?: string | null;
    }): Promise<MachineMaintenanceRecord> {
        const result = await db.query<MachineMaintenanceRecord>(
            `INSERT INTO machine_maintenances (machine_id, problem, started_at, created_by_user_id)
             VALUES ($1, $2, COALESCE($3::TIMESTAMPTZ, NOW()), $4)
             RETURNING id, machine_id, started_at, ended_at, problem, solution, created_by_user_id, closed_by_user_id, created_at, updated_at`,
            [input.machineId, input.problem, input.startedAt ?? null, input.createdByUserId ?? null],
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<MachineMaintenanceRecord | null> {
        const result = await db.query<MachineMaintenanceRecord>(
            `SELECT id, machine_id, started_at, ended_at, problem, solution, created_by_user_id, closed_by_user_id, deleted_at, deleted_by_user_id, created_at, updated_at
             FROM machine_maintenances
             WHERE id = $1
             LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async findOpenByMachineId(machineId: string): Promise<MachineMaintenanceRecord | null> {
        const result = await db.query<MachineMaintenanceRecord>(
            `SELECT id, machine_id, started_at, ended_at, problem, solution, created_by_user_id, closed_by_user_id, deleted_at, deleted_by_user_id, created_at, updated_at
             FROM machine_maintenances
             WHERE machine_id = $1 AND ended_at IS NULL AND deleted_at IS NULL
             ORDER BY started_at DESC
             LIMIT 1`,
            [machineId],
        );

        return result.rows[0] || null;
    },

    async close(id: string, input: {
        solution?: string | null;
        endedAt?: string;
        closedByUserId?: string | null;
    }): Promise<MachineMaintenanceRecord | null> {
        const result = await db.query<MachineMaintenanceRecord>(
            `UPDATE machine_maintenances
             SET ended_at = COALESCE($2::TIMESTAMPTZ, NOW()),
                 solution = $3,
                 closed_by_user_id = $4,
                 updated_at = NOW()
             WHERE id = $1 AND ended_at IS NULL
             RETURNING id, machine_id, started_at, ended_at, problem, solution, created_by_user_id, closed_by_user_id, created_at, updated_at`,
            [id, input.endedAt ?? null, input.solution ?? null, input.closedByUserId ?? null],
        );

        return result.rows[0] || null;
    },

    async cancel(id: string, deletedByUserId: string): Promise<MachineMaintenanceRecord | null> {
        const result = await db.query<MachineMaintenanceRecord>(
            `UPDATE machine_maintenances
             SET deleted_at = NOW(),
                 deleted_by_user_id = $2,
                 updated_at = NOW()
             WHERE id = $1 AND ended_at IS NULL AND deleted_at IS NULL
             RETURNING id, machine_id, started_at, ended_at, problem, solution, created_by_user_id, closed_by_user_id, deleted_at, deleted_by_user_id, created_at, updated_at`,
            [id, deletedByUserId],
        );

        return result.rows[0] || null;
    },

    async listByMachineId(machineId: string): Promise<MachineMaintenanceView[]> {
        const result = await db.query<MachineMaintenanceView>(
            `SELECT mm.id,
                    mm.machine_id AS "machineId",
                    m.name AS "machineName",
                    m.number AS "machineNumber",
                    m.brand AS "machineBrand",
                    m.model AS "machineModel",
                    m.type AS "machineType",
                    mm.started_at AS "startedAt",
                    mm.ended_at AS "endedAt",
                    mm.problem,
                    mm.solution,
                    mm.created_by_user_id AS "createdByUserId",
                    uc.name AS "createdByUserName",
                    mm.closed_by_user_id AS "closedByUserId",
                    ucl.name AS "closedByUserName",
                    mm.deleted_at AS "deletedAt",
                    mm.created_at AS "createdAt"
             FROM machine_maintenances mm
             INNER JOIN machines m ON m.id = mm.machine_id
             LEFT JOIN users uc ON uc.id = mm.created_by_user_id
             LEFT JOIN users ucl ON ucl.id = mm.closed_by_user_id
             WHERE mm.machine_id = $1
             ORDER BY mm.started_at DESC`,
            [machineId],
        );

        return result.rows;
    },

    async listAll(): Promise<MachineMaintenanceView[]> {
        const result = await db.query<MachineMaintenanceView>(
            `SELECT mm.id,
                    mm.machine_id AS "machineId",
                    m.name AS "machineName",
                    m.number AS "machineNumber",
                    m.brand AS "machineBrand",
                    m.model AS "machineModel",
                    m.type AS "machineType",
                    mm.started_at AS "startedAt",
                    mm.ended_at AS "endedAt",
                    mm.problem,
                    mm.solution,
                    mm.created_by_user_id AS "createdByUserId",
                    uc.name AS "createdByUserName",
                    mm.closed_by_user_id AS "closedByUserId",
                    ucl.name AS "closedByUserName",
                    mm.deleted_at AS "deletedAt",
                    mm.created_at AS "createdAt"
             FROM machine_maintenances mm
             INNER JOIN machines m ON m.id = mm.machine_id
             LEFT JOIN users uc ON uc.id = mm.created_by_user_id
             LEFT JOIN users ucl ON ucl.id = mm.closed_by_user_id
             ORDER BY mm.started_at DESC`,
            [],
        );

        return result.rows;
    },

    async listPendingActivation(now: string): Promise<MachineMaintenanceRecord[]> {
        const result = await db.query<MachineMaintenanceRecord>(
            `SELECT mm.id, mm.machine_id, mm.started_at, mm.ended_at, mm.problem, mm.solution,
                    mm.created_by_user_id, mm.closed_by_user_id, mm.deleted_at, mm.deleted_by_user_id, mm.created_at, mm.updated_at
             FROM machine_maintenances mm
             INNER JOIN machines m ON m.id = mm.machine_id
             WHERE mm.ended_at IS NULL
               AND mm.deleted_at IS NULL
               AND mm.started_at <= $1::TIMESTAMPTZ
               AND m.status = 'ACTIVE'`,
            [now],
        );

        return result.rows;
    },

    async listAllPaginated(input: {
        cursor?: string; // ISO datetime — busca registros com started_at <= cursor
        limit: number;
    }): Promise<MachineMaintenanceView[]> {
        const cursor = input.cursor ?? new Date().toISOString();
        const result = await db.query<MachineMaintenanceView>(
            `SELECT mm.id,
                    mm.machine_id AS "machineId",
                    m.name AS "machineName",
                    m.number AS "machineNumber",
                    m.brand AS "machineBrand",
                    m.model AS "machineModel",
                    m.type AS "machineType",
                    mm.started_at AS "startedAt",
                    mm.ended_at AS "endedAt",
                    mm.problem,
                    mm.solution,
                    mm.created_by_user_id AS "createdByUserId",
                    uc.name AS "createdByUserName",
                    mm.closed_by_user_id AS "closedByUserId",
                    ucl.name AS "closedByUserName",
                    mm.deleted_at AS "deletedAt",
                    mm.created_at AS "createdAt"
             FROM machine_maintenances mm
             INNER JOIN machines m ON m.id = mm.machine_id
             LEFT JOIN users uc ON uc.id = mm.created_by_user_id
             LEFT JOIN users ucl ON ucl.id = mm.closed_by_user_id
             WHERE mm.started_at <= $1::TIMESTAMPTZ
             ORDER BY mm.started_at DESC
             LIMIT $2`,
            [cursor, input.limit],
        );

        return result.rows;
    },
};
