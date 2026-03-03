import type { Request, Response } from 'express';
import { db } from '../db/pool';

export const adminController = {
    async dashboard(_req: Request, res: Response) {
        const [reservations, sessions, incidents, invoices] = await Promise.all([
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM reservations', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM laundry_sessions', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM incidents', []),
            db.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM invoices', []),
        ]);

        res.ok({
            reservationsTotal: Number(reservations.rows[0]?.total || 0),
            sessionsTotal: Number(sessions.rows[0]?.total || 0),
            incidentsTotal: Number(incidents.rows[0]?.total || 0),
            invoicesTotal: Number(invoices.rows[0]?.total || 0),
            generatedAt: new Date().toISOString(),
        });
    },
};
