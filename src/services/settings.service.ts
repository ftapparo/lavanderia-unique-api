import { systemSettingsRepository } from '../db/repositories/system-settings.repository';
import { AppError } from '../utils/app-error';

export const settingsService = {
    async get() {
        return systemSettingsRepository.get();
    },

    async update(input: {
        checkinWindowBeforeMinutes?: number;
        checkinWindowAfterMinutes?: number;
        reservationDurationHours?: number;
        reservationStartMode?: 'ANY_TIME' | 'FULL_HOUR';
        overtimeThresholdWatts?: number;
        consumptionPollSeconds?: number;
        billingMode?: 'PER_USE' | 'PER_KWH';
        pricePerUse?: number;
        pricePerKwh?: number;
        chargeNoShow?: boolean;
    }, actorUserId: string) {
        if (input.checkinWindowBeforeMinutes !== undefined && input.checkinWindowBeforeMinutes < 0) {
            throw new AppError('checkinWindowBeforeMinutes nao pode ser negativo.', 400);
        }
        if (input.checkinWindowAfterMinutes !== undefined && input.checkinWindowAfterMinutes < 0) {
            throw new AppError('checkinWindowAfterMinutes nao pode ser negativo.', 400);
        }
        if (input.reservationDurationHours !== undefined && (!Number.isInteger(input.reservationDurationHours) || input.reservationDurationHours <= 0 || input.reservationDurationHours > 24)) {
            throw new AppError('reservationDurationHours deve ser um inteiro entre 1 e 24.', 400);
        }
        if (input.reservationStartMode !== undefined && !['ANY_TIME', 'FULL_HOUR'].includes(input.reservationStartMode)) {
            throw new AppError('reservationStartMode invalido.', 400);
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
