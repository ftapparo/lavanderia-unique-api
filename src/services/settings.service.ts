import { env } from '../config/env';
import { systemSettingsRepository } from '../db/repositories/system-settings.repository';
import { AppError } from '../utils/app-error';

export const settingsService = {
    async get() {
        const settings = await systemSettingsRepository.get();
        return {
            ...settings,
            fallbackFromEnv: {
                checkinWindowBeforeMinutes: env.checkinWindowBeforeMinutes,
                checkinWindowAfterMinutes: env.checkinWindowAfterMinutes,
                billingMode: env.billingMode,
                pricePerUse: env.pricePerUse,
                pricePerKwh: env.pricePerKwh,
            },
        };
    },

    async update(input: {
        checkinWindowBeforeMinutes?: number;
        checkinWindowAfterMinutes?: number;
        overtimeThresholdWatts?: number;
        consumptionPollSeconds?: number;
        billingMode?: 'PER_USE' | 'PER_KWH';
        pricePerUse?: number;
        pricePerKwh?: number;
    }, actorUserId: string) {
        if (input.checkinWindowBeforeMinutes !== undefined && input.checkinWindowBeforeMinutes < 0) {
            throw new AppError('checkinWindowBeforeMinutes nao pode ser negativo.', 400);
        }
        if (input.checkinWindowAfterMinutes !== undefined && input.checkinWindowAfterMinutes < 0) {
            throw new AppError('checkinWindowAfterMinutes nao pode ser negativo.', 400);
        }
        if (input.overtimeThresholdWatts !== undefined && input.overtimeThresholdWatts < 0) {
            throw new AppError('overtimeThresholdWatts nao pode ser negativo.', 400);
        }
        if (input.consumptionPollSeconds !== undefined && input.consumptionPollSeconds <= 0) {
            throw new AppError('consumptionPollSeconds deve ser maior que zero.', 400);
        }
        if (input.pricePerUse !== undefined && input.pricePerUse < 0) {
            throw new AppError('pricePerUse nao pode ser negativo.', 400);
        }
        if (input.pricePerKwh !== undefined && input.pricePerKwh < 0) {
            throw new AppError('pricePerKwh nao pode ser negativo.', 400);
        }

        return systemSettingsRepository.update({
            ...input,
            updatedByUserId: actorUserId,
        });
    },
};
