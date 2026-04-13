import * as XLSX from 'xlsx';
import { db } from '../db/pool';
import { invoicesRepository } from '../db/repositories/invoices.repository';
import { membershipsRepository } from '../db/repositories/memberships.repository';
import { reservationsRepository } from '../db/repositories/reservations.repository';
import { systemSettingsRepository } from '../db/repositories/system-settings.repository';
import { AppError } from '../utils/app-error';
import { notificationEmailService } from './notification-email.service';

const toCompetence = (value: string | undefined): string => {
    if (!value) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}$/.test(normalized)) {
        throw new AppError('Competencia invalida. Use YYYY-MM.', 400);
    }
    return normalized;
};

type BillingEntry = {
    reservationId: string;
    userId: string;
    unitId: string;
    startAt: string;
    machinePairName: string;
    laundrySessionId: string | null;
    energyKwh: number;
};

type BillingMode = 'PER_USE' | 'PER_KWH';
type InvoiceBillingMode = BillingMode | 'MIXED';

const toCsv = (headers: string[], rows: Array<Array<string | number>>): string => {
    const encode = (value: string | number): string => {
        const text = String(value ?? '');
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    const all = [headers, ...rows];
    return all.map((line) => line.map(encode).join(',')).join('\n');
};

export const billingService = {
    async run(input: { competence?: string }) {
        const competence = toCompetence(input.competence);
        const finishedReservations = await reservationsRepository.listFinishedByCompetence(competence);
        if (finishedReservations.length === 0) {
            const settings = await systemSettingsRepository.get();
            return {
                competence,
                billingMode: settings.billingMode,
                invoicesCreated: 0,
                itemsCreated: 0,
                totalAmount: 0,
            };
        }

        const sessionIds = finishedReservations
            .map((reservation) => reservation.laundrySessionId)
            .filter((value): value is string => Boolean(value));

        const energyBySession = new Map<string, number>();
        if (sessionIds.length > 0) {
            const result = await db.query<{
                laundrySessionId: string;
                totalEnergyKwh: string;
            }>(
                `SELECT laundry_session_id AS "laundrySessionId",
                        COALESCE(SUM(energy_kwh), 0)::text AS "totalEnergyKwh"
                 FROM consumption_samples
                 WHERE laundry_session_id = ANY($1)
                 GROUP BY laundry_session_id`,
                [sessionIds],
            );

            result.rows.forEach((row) => {
                energyBySession.set(row.laundrySessionId, Number(row.totalEnergyKwh));
            });
        }

        const entries: BillingEntry[] = finishedReservations.map((reservation) => ({
            ...reservation,
            energyKwh: reservation.laundrySessionId ? (energyBySession.get(reservation.laundrySessionId) ?? 0) : 0,
        }));

        const grouped = new Map<string, BillingEntry[]>();
        entries.forEach((entry) => {
            const key = entry.unitId;
            const current = grouped.get(key) || [];
            current.push(entry);
            grouped.set(key, current);
        });

        const client = await db.connect();
        let invoicesCreated = 0;
        let itemsCreated = 0;
        let totalAmount = 0;
        const runBillingModes = new Set<BillingMode>();
        const settingsByStartAt = new Map<string, Awaited<ReturnType<typeof systemSettingsRepository.getAsOf>>>();

        try {
            await client.query('BEGIN');
            await invoicesRepository.deleteByCompetence(competence, client);

            for (const [, items] of grouped) {
                const first = items[0];
                const responsibleReferenceDate = items
                    .map((entry) => new Date(entry.startAt).toISOString().slice(0, 10))
                    .sort()
                    .at(-1) || `${competence}-01`;
                const responsibleUserId = await membershipsRepository.findBillingResponsibleUserByUnitOnDate(
                    first.unitId,
                    responsibleReferenceDate,
                ) || first.userId;
                const itemSettings = await Promise.all(items.map(async (entry) => {
                    if (settingsByStartAt.has(entry.startAt)) {
                        return settingsByStartAt.get(entry.startAt)!;
                    }
                    const asOf = await systemSettingsRepository.getAsOf(entry.startAt);
                    settingsByStartAt.set(entry.startAt, asOf);
                    return asOf;
                }));

                const invoiceModes = new Set<BillingMode>();
                const invoiceTotal = items.reduce((acc, entry, index) => {
                    const settings = itemSettings[index];
                    invoiceModes.add(settings.billingMode);
                    runBillingModes.add(settings.billingMode);
                    if (settings.billingMode === 'PER_KWH') {
                        return acc + (entry.energyKwh * settings.pricePerKwh);
                    }
                    return acc + settings.pricePerUse;
                }, 0);

                const invoiceBillingMode: InvoiceBillingMode = invoiceModes.size === 1
                    ? Array.from(invoiceModes)[0]
                    : 'MIXED';

                const invoice = await invoicesRepository.create({
                    competence,
                    userId: responsibleUserId,
                    unitId: first.unitId,
                    billingMode: invoiceBillingMode,
                    totalAmount: Number(invoiceTotal.toFixed(2)),
                }, client);

                invoicesCreated += 1;
                totalAmount += Number(invoice.total_amount);

                for (const [index, entry] of items.entries()) {
                    const settings = itemSettings[index];
                    const quantity = settings.billingMode === 'PER_KWH' ? entry.energyKwh : 1;
                    const unitPrice = settings.billingMode === 'PER_KWH' ? settings.pricePerKwh : settings.pricePerUse;
                    const lineTotal = Number((quantity * unitPrice).toFixed(2));

                    await invoicesRepository.createItem({
                        invoiceId: invoice.id,
                        reservationId: entry.reservationId,
                        laundrySessionId: entry.laundrySessionId,
                        description: `Reserva ${entry.machinePairName} em ${new Date(entry.startAt).toLocaleString('pt-BR')}`,
                        quantity,
                        unitPrice,
                        totalAmount: lineTotal,
                        metadata: {
                            billingMode: settings.billingMode,
                            energyKwh: entry.energyKwh,
                            billedByUnit: true,
                            unitId: entry.unitId,
                        },
                    }, client);

                    itemsCreated += 1;
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        const responseBillingMode: InvoiceBillingMode = runBillingModes.size === 1
            ? Array.from(runBillingModes)[0]
            : 'MIXED';

        const response = {
            competence,
            billingMode: responseBillingMode,
            invoicesCreated,
            itemsCreated,
            totalAmount: Number(totalAmount.toFixed(2)),
        };

        const reportTo = (process.env.BILLING_REPORT_TO || '').trim();
        if (reportTo) {
            try {
                const exported = await this.exportCompetence(competence, 'xlsx');
                const csv = await this.exportCompetence(competence, 'csv');
                await notificationEmailService.sendBillingReport({
                    to: reportTo,
                    competence,
                    csvContent: csv.csv,
                    xlsxContentBase64: exported.base64,
                });
            } catch (error) {
                console.error('[Billing] Falha ao enviar e-mail de faturamento.', error);
            }
        }

        return response;
    },

    async listInvoices(userId: string, isAdmin: boolean) {
        if (isAdmin) {
            return invoicesRepository.listAll();
        }

        const todayIso = new Date().toISOString().slice(0, 10);
        const accessibleUnitIds = await membershipsRepository.listAccessibleUnitIdsByUserOnDate(userId, todayIso);
        return invoicesRepository.listByUnitIds(accessibleUnitIds);
    },

    async getInvoiceById(id: string, userId: string, isAdmin: boolean) {
        const invoice = await invoicesRepository.findById(id);
        if (!invoice) {
            throw new AppError('Fatura nao encontrada.', 404);
        }

        if (!isAdmin) {
            if (!invoice.unitId) {
                if (invoice.userId !== userId) {
                    throw new AppError('Acesso negado para consultar esta fatura.', 403);
                }
            } else {
                const todayIso = new Date().toISOString().slice(0, 10);
                const accessibleUnitIds = await membershipsRepository.listAccessibleUnitIdsByUserOnDate(userId, todayIso);
                if (!accessibleUnitIds.includes(invoice.unitId)) {
                    throw new AppError('Acesso negado para consultar esta fatura.', 403);
                }
            }
        }

        const items = await invoicesRepository.listItemsByInvoiceId(id);
        return {
            ...invoice,
            items,
        };
    },

    async exportCompetence(competenceInput: string, format: 'csv' | 'xlsx' = 'csv') {
        const competence = toCompetence(competenceInput);
        const invoices = (await invoicesRepository.listAll())
            .filter((invoice) => invoice.competence === competence);

        const rows = invoices.map((invoice) => [
            invoice.competence,
            invoice.id,
            invoice.userName,
            invoice.unitName || '',
            invoice.billingMode,
            invoice.totalAmount.toFixed(2),
            invoice.generatedAt,
        ]);

        const csv = toCsv(
            ['competence', 'invoice_id', 'user_name', 'unit_name', 'billing_mode', 'total_amount', 'generated_at'],
            rows,
        );

        if (format === 'xlsx') {
            const worksheet = XLSX.utils.aoa_to_sheet([
                ['competence', 'invoice_id', 'user_name', 'unit_name', 'billing_mode', 'total_amount', 'generated_at'],
                ...rows,
            ]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing');
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

            return {
                competence,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                fileName: `billing-${competence}.xlsx`,
                fileBuffer: buffer,
                base64: buffer.toString('base64'),
                csv,
            };
        }

        return {
            competence,
            contentType: 'text/csv; charset=utf-8',
            fileName: `billing-${competence}.csv`,
            csv,
            fileBuffer: Buffer.from(csv, 'utf-8'),
            base64: Buffer.from(csv, 'utf-8').toString('base64'),
        };
    },
};
