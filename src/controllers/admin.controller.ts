import type { Request, Response } from 'express';
import { db } from '../db/pool';
import { opsJobsService } from '../services/ops-jobs.service';
import { jobConfigsService } from '../services/job-configs.service';
import { tuyaClient } from '../integrations/tuya/tuya-client';
import { sessionsService } from '../services/sessions.service';
import { AppError } from '../utils/app-error';
import { isUuid } from '../utils/validators';

export const adminController = {
    async dashboard(_req: Request, res: Response) {
        const [reservations, sessions, incidents, invoices, activeSessions, tuyaErrors24h] = await Promise.all([
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM reservations', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM laundry_sessions', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM incidents', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM invoices', []),
            db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM laundry_sessions WHERE status = 'ACTIVE'`, []),
            db.query<{ total: string }>(
                `SELECT COUNT(*)::text AS total
                 FROM incidents
                 WHERE type = 'TUYA_ERROR'
                   AND created_at >= (NOW() - INTERVAL '24 hour')`,
                [],
            ),
        ]);

        res.ok({
            reservationsTotal: Number(reservations.rows[0]?.total || 0),
            sessionsTotal: Number(sessions.rows[0]?.total || 0),
            incidentsTotal: Number(incidents.rows[0]?.total || 0),
            invoicesTotal: Number(invoices.rows[0]?.total || 0),
            activeSessionsTotal: Number(activeSessions.rows[0]?.total || 0),
            tuyaErrorsLast24h: Number(tuyaErrors24h.rows[0]?.total || 0),
            jobs: opsJobsService.getStatus(),
            generatedAt: new Date().toISOString(),
        });
    },

    async opsHealth(_req: Request, res: Response) {
        let dbStatus: 'ok' | 'error' = 'ok';
        let tuyaStatus: 'ok' | 'error' = 'ok';
        let tuyaDetails: unknown = null;

        try {
            await db.query('SELECT 1', []);
        } catch (error) {
            dbStatus = 'error';
        }

        try {
            tuyaDetails = await tuyaClient.health();
        } catch (error) {
            tuyaStatus = 'error';
            tuyaDetails = error instanceof Error ? error.message : error;
        }

        res.ok({
            db: dbStatus,
            tuya: tuyaStatus,
            tuyaDetails,
            jobs: opsJobsService.getStatus(),
            checkedAt: new Date().toISOString(),
        });
    },

    async listActiveSessions(_req: Request, res: Response) {
        const result = await db.query<{
            id: string;
            reservationId: string;
            userName: string;
            unitName: string;
            machinePairName: string;
            startedAt: string;
            overtimeStartedAt: string | null;
        }>(
            `SELECT ls.id,
                    ls.reservation_id AS "reservationId",
                    us.name AS "userName",
                    u.name AS "unitName",
                    mp.name AS "machinePairName",
                    ls.started_at AS "startedAt",
                    ls.overtime_started_at AS "overtimeStartedAt"
             FROM laundry_sessions ls
             INNER JOIN users us ON us.id = ls.user_id
             INNER JOIN units u ON u.id = ls.unit_id
             INNER JOIN machine_pairs mp ON mp.id = ls.machine_pair_id
             WHERE ls.status = 'ACTIVE'
             ORDER BY ls.started_at ASC`,
            [],
        );

        res.ok(result.rows);
    },

    async listJobs(_req: Request, res: Response) {
        const configs = await jobConfigsService.list();
        const status = opsJobsService.getStatus();
        const merged = configs.map((config) => ({
            ...config,
            runtimeState: status.jobs[config.name] ?? null,
        }));
        res.ok(merged);
    },

    async updateJob(req: Request, res: Response) {
        const name = String(req.params.name || '');
        const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
        const cronExpression = typeof req.body?.cronExpression === 'string' ? req.body.cronExpression : undefined;
        const active = typeof req.body?.active === 'boolean' ? req.body.active : undefined;

        const updated = await jobConfigsService.update({
            name,
            description,
            cronExpression,
            active,
            actorUserId: String(req.auth?.userId),
        });
        res.ok(updated);
    },

    async reconcileSession(req: Request, res: Response) {
        const sessionId = String(req.params.id || '');
        if (!isUuid(sessionId)) {
            throw new AppError('Identificador de sessao invalido.', 400);
        }
        const session = await sessionsService.finishSession(
            sessionId,
            String(req.auth?.userId),
            true,
        );

        res.ok(session);
    },
};
