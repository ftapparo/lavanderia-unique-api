import { db } from '../pool';
import type { SystemSettingsRecord, SystemSettingsView } from '../../types/domain.types';

const mapView = (row: SystemSettingsRecord): SystemSettingsView => ({
    checkinWindowBeforeMinutes: row.checkin_window_before_minutes,
    checkinWindowAfterMinutes: row.checkin_window_after_minutes,
    overtimeThresholdWatts: Number(row.overtime_threshold_watts),
    consumptionPollSeconds: row.consumption_poll_seconds,
    billingMode: row.billing_mode,
    pricePerUse: Number(row.price_per_use),
    pricePerKwh: Number(row.price_per_kwh),
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at,
});

export const systemSettingsRepository = {
    async get(): Promise<SystemSettingsView> {
        const result = await db.query<SystemSettingsRecord>(
            `SELECT id,
                    checkin_window_before_minutes,
                    checkin_window_after_minutes,
                    overtime_threshold_watts,
                    consumption_poll_seconds,
                    billing_mode,
                    price_per_use,
                    price_per_kwh,
                    updated_by_user_id,
                    updated_at
             FROM system_settings
             WHERE id = 1
             LIMIT 1`,
            [],
        );

        if (result.rows[0]) {
            return mapView(result.rows[0]);
        }

        const insertResult = await db.query<SystemSettingsRecord>(
            `INSERT INTO system_settings (
                id,
                checkin_window_before_minutes,
                checkin_window_after_minutes,
                overtime_threshold_watts,
                consumption_poll_seconds,
                billing_mode,
                price_per_use,
                price_per_kwh
            )
            VALUES (1, 15, 30, 15, 30, 'PER_USE', 0, 0)
            RETURNING id,
                      checkin_window_before_minutes,
                      checkin_window_after_minutes,
                      overtime_threshold_watts,
                      consumption_poll_seconds,
                      billing_mode,
                      price_per_use,
                      price_per_kwh,
                      updated_by_user_id,
                      updated_at`,
            [],
        );

        return mapView(insertResult.rows[0]);
    },

    async update(input: {
        checkinWindowBeforeMinutes?: number;
        checkinWindowAfterMinutes?: number;
        overtimeThresholdWatts?: number;
        consumptionPollSeconds?: number;
        billingMode?: 'PER_USE' | 'PER_KWH';
        pricePerUse?: number;
        pricePerKwh?: number;
        updatedByUserId: string;
    }): Promise<SystemSettingsView> {
        const result = await db.query<SystemSettingsRecord>(
            `UPDATE system_settings
             SET checkin_window_before_minutes = COALESCE($1, checkin_window_before_minutes),
                 checkin_window_after_minutes = COALESCE($2, checkin_window_after_minutes),
                 overtime_threshold_watts = COALESCE($3, overtime_threshold_watts),
                 consumption_poll_seconds = COALESCE($4, consumption_poll_seconds),
                 billing_mode = COALESCE($5, billing_mode),
                 price_per_use = COALESCE($6, price_per_use),
                 price_per_kwh = COALESCE($7, price_per_kwh),
                 updated_by_user_id = $8,
                 updated_at = NOW()
             WHERE id = 1
             RETURNING id,
                       checkin_window_before_minutes,
                       checkin_window_after_minutes,
                       overtime_threshold_watts,
                       consumption_poll_seconds,
                       billing_mode,
                       price_per_use,
                       price_per_kwh,
                       updated_by_user_id,
                       updated_at`,
            [
                input.checkinWindowBeforeMinutes ?? null,
                input.checkinWindowAfterMinutes ?? null,
                input.overtimeThresholdWatts ?? null,
                input.consumptionPollSeconds ?? null,
                input.billingMode ?? null,
                input.pricePerUse ?? null,
                input.pricePerKwh ?? null,
                input.updatedByUserId,
            ],
        );

        return mapView(result.rows[0]);
    },
};
