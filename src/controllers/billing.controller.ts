import type { Request, Response } from 'express';
import { billingService } from '../services/billing.service';
import { hasAdminAccess } from '../utils/auth-role';

export const billingController = {
    async run(req: Request, res: Response) {
        const result = await billingService.run({
            competence: req.body?.competence ? String(req.body.competence) : undefined,
        });
        res.ok(result);
    },

    async listInvoices(req: Request, res: Response) {
        const invoices = await billingService.listInvoices(String(req.auth?.userId), hasAdminAccess(req.auth?.role));
        res.ok(invoices);
    },

    async getInvoiceById(req: Request, res: Response) {
        const invoice = await billingService.getInvoiceById(
            String(req.params.id || ''),
            String(req.auth?.userId),
            hasAdminAccess(req.auth?.role),
        );
        res.ok(invoice);
    },

    async exportCompetence(req: Request, res: Response) {
        const format = String(req.query?.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
        const exported = await billingService.exportCompetence(String(req.params.competence || ''), format);
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
        res.send(exported.fileBuffer);
    },
};
