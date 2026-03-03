import type { Request, Response } from 'express';
import { settingsService } from '../services/settings.service';

export const settingsController = {
    async get(_req: Request, res: Response) {
        const settings = await settingsService.get();
        res.ok(settings);
    },

    async update(req: Request, res: Response) {
        const updated = await settingsService.update({
            checkinWindowBeforeMinutes: typeof req.body?.checkinWindowBeforeMinutes === 'number' ? req.body.checkinWindowBeforeMinutes : undefined,
            checkinWindowAfterMinutes: typeof req.body?.checkinWindowAfterMinutes === 'number' ? req.body.checkinWindowAfterMinutes : undefined,
            overtimeThresholdWatts: typeof req.body?.overtimeThresholdWatts === 'number' ? req.body.overtimeThresholdWatts : undefined,
            consumptionPollSeconds: typeof req.body?.consumptionPollSeconds === 'number' ? req.body.consumptionPollSeconds : undefined,
            billingMode: req.body?.billingMode ? String(req.body.billingMode).toUpperCase() as 'PER_USE' | 'PER_KWH' : undefined,
            pricePerUse: typeof req.body?.pricePerUse === 'number' ? req.body.pricePerUse : undefined,
            pricePerKwh: typeof req.body?.pricePerKwh === 'number' ? req.body.pricePerKwh : undefined,
        }, String(req.auth?.userId));

        res.ok(updated);
    },
};
