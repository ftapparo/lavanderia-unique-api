import type { Request, Response } from 'express';
import { billingService } from '../services/billing.service';
import { hasAdminAccess } from '../utils/auth-role';
import { AppError } from '../utils/app-error';
import { isCompetence, isUuid } from '../utils/validators';

export const billingController = {
    async run(req: Request, res: Response) {
        const competence = req.body?.competence ? String(req.body.competence) : undefined;
        if (competence && !isCompetence(competence)) {
            throw new AppError('Competencia invalida. Use YYYY-MM.', 400);
        }
        const result = await billingService.run({
            competence,
        });
        res.ok(result);
    },

    async listInvoices(req: Request, res: Response) {
        const invoices = await billingService.listInvoices(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(invoices);
    },

    async getInvoiceById(req: Request, res: Response) {
        const invoiceId = String(req.params.id || '');
        if (!isUuid(invoiceId)) {
            throw new AppError('Identificador de fatura invalido.', 400);
        }

        const invoice = await billingService.getInvoiceById(
            invoiceId,
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(invoice);
    },

    async exportCompetence(req: Request, res: Response) {
        const competence = String(req.params.competence || '');
        if (!isCompetence(competence)) {
            throw new AppError('Competencia invalida. Use YYYY-MM.', 400);
        }
        const format = String(req.query?.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
        const exported = await billingService.exportCompetence(competence, format);
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
        res.send(exported.fileBuffer);
    },
};
