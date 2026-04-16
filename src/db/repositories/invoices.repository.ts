import type { PoolClient } from 'pg';
import { db } from '../pool';
import type { InvoiceItemView, InvoiceRecord, InvoiceView } from '../../types/domain.types';

const mapInvoiceTotal = (value: string): number => Number(value);

export const invoicesRepository = {
    async deleteByCompetence(competence: string, client?: PoolClient): Promise<void> {
        if (client) {
            await client.query('DELETE FROM invoices WHERE competence = $1', [competence]);
            return;
        }
        await db.query('DELETE FROM invoices WHERE competence = $1', [competence]);
    },

    async create(input: {
        competence: string;
        userId: string;
        unitId: string | null;
        billingMode: 'PER_USE' | 'PER_KWH' | 'MIXED';
        totalAmount: number;
    }, client?: PoolClient): Promise<InvoiceRecord> {
        const sql = `INSERT INTO invoices (
                competence,
                user_id,
                unit_id,
                billing_mode,
                total_amount
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, competence, user_id, unit_id, billing_mode, total_amount, generated_at, created_at, updated_at`;
        const params = [input.competence, input.userId, input.unitId, input.billingMode, input.totalAmount];
        const result = client
            ? await client.query<InvoiceRecord>(sql, params)
            : await db.query<InvoiceRecord>(sql, params);
        return result.rows[0];
    },

    async createItem(input: {
        invoiceId: string;
        reservationId: string | null;
        laundrySessionId: string | null;
        chargeType: 'USE' | 'NO_SHOW';
        description: string;
        quantity: number;
        unitPrice: number;
        totalAmount: number;
        metadata?: Record<string, unknown>;
    }, client?: PoolClient): Promise<void> {
        const sql = `INSERT INTO invoice_items (
                invoice_id,
                reservation_id,
                laundry_session_id,
                charge_type,
                description,
                quantity,
                unit_price,
                total_amount,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
        const params = [
            input.invoiceId,
            input.reservationId,
            input.laundrySessionId,
            input.chargeType,
            input.description,
            input.quantity,
            input.unitPrice,
            input.totalAmount,
            input.metadata ?? {},
        ];
        if (client) {
            await client.query(sql, params);
            return;
        }
        await db.query(sql, params);
    },

    async listAll(): Promise<InvoiceView[]> {
        const result = await db.query<InvoiceView & { total_amount_text: string }>(
            `SELECT i.id,
                    i.competence,
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.billing_mode AS "billingMode",
                    i.total_amount::text AS "total_amount_text",
                    i.generated_at AS "generatedAt",
                    i.created_at AS "createdAt"
             FROM invoices i
             INNER JOIN users us ON us.id = i.user_id
             LEFT JOIN units u ON u.id = i.unit_id
             ORDER BY i.competence DESC, us.name`,
            [],
        );

        return result.rows.map((row) => ({
            ...row,
            totalAmount: mapInvoiceTotal(row.total_amount_text),
        }));
    },

    async listByUserId(userId: string): Promise<InvoiceView[]> {
        const result = await db.query<InvoiceView & { total_amount_text: string }>(
            `SELECT i.id,
                    i.competence,
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.billing_mode AS "billingMode",
                    i.total_amount::text AS "total_amount_text",
                    i.generated_at AS "generatedAt",
                    i.created_at AS "createdAt"
             FROM invoices i
             INNER JOIN users us ON us.id = i.user_id
             LEFT JOIN units u ON u.id = i.unit_id
             WHERE i.user_id = $1
             ORDER BY i.competence DESC`,
            [userId],
        );

        return result.rows.map((row) => ({
            ...row,
            totalAmount: mapInvoiceTotal(row.total_amount_text),
        }));
    },

    async listByUnitIds(unitIds: string[]): Promise<InvoiceView[]> {
        if (unitIds.length === 0) {
            return [];
        }

        const result = await db.query<InvoiceView & { total_amount_text: string }>(
            `SELECT i.id,
                    i.competence,
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.billing_mode AS "billingMode",
                    i.total_amount::text AS "total_amount_text",
                    i.generated_at AS "generatedAt",
                    i.created_at AS "createdAt"
             FROM invoices i
             INNER JOIN users us ON us.id = i.user_id
             LEFT JOIN units u ON u.id = i.unit_id
             WHERE i.unit_id = ANY($1::uuid[])
             ORDER BY i.competence DESC, u.name, us.name`,
            [unitIds],
        );

        return result.rows.map((row) => ({
            ...row,
            totalAmount: mapInvoiceTotal(row.total_amount_text),
        }));
    },

    async findById(id: string): Promise<InvoiceView | null> {
        const result = await db.query<InvoiceView & { total_amount_text: string }>(
            `SELECT i.id,
                    i.competence,
                    i.user_id AS "userId",
                    us.name AS "userName",
                    i.unit_id AS "unitId",
                    u.name AS "unitName",
                    i.billing_mode AS "billingMode",
                    i.total_amount::text AS "total_amount_text",
                    i.generated_at AS "generatedAt",
                    i.created_at AS "createdAt"
             FROM invoices i
             INNER JOIN users us ON us.id = i.user_id
             LEFT JOIN units u ON u.id = i.unit_id
             WHERE i.id = $1
             LIMIT 1`,
            [id],
        );

        const row = result.rows[0];
        if (!row) {
            return null;
        }

        return {
            ...row,
            totalAmount: mapInvoiceTotal(row.total_amount_text),
        };
    },

    async listItemsByInvoiceId(invoiceId: string): Promise<InvoiceItemView[]> {
        const result = await db.query<InvoiceItemView & {
            quantity_text: string;
            unit_price_text: string;
            total_amount_text: string;
        }>(
            `SELECT ii.id,
                    ii.invoice_id AS "invoiceId",
                    ii.reservation_id AS "reservationId",
                    ii.laundry_session_id AS "laundrySessionId",
                    ii.charge_type AS "chargeType",
                    ii.description,
                    ii.quantity::text AS "quantity_text",
                    ii.unit_price::text AS "unit_price_text",
                    ii.total_amount::text AS "total_amount_text",
                    ii.metadata,
                    ii.created_at AS "createdAt"
             FROM invoice_items ii
             WHERE ii.invoice_id = $1
             ORDER BY ii.created_at ASC`,
            [invoiceId],
        );

        return result.rows.map((row) => ({
            ...row,
            chargeType: row.chargeType as 'USE' | 'NO_SHOW',
            quantity: Number(row.quantity_text),
            unitPrice: Number(row.unit_price_text),
            totalAmount: Number(row.total_amount_text),
        }));
    },
};
