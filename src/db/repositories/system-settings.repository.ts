import type { PoolClient } from 'pg';
import { db } from '../pool';
import type {
    SettingsVariableName,
    SettingsVariableRecord,
    SystemSettingsView,
} from '../../types/domain.types';

const SETTINGS_DEFAULTS: SystemSettingsView = {
    checkinWindowBeforeMinutes: 15,
    checkinWindowAfterMinutes: 30,
    reservationDurationHours: 2,
    reservationStartMode: 'FULL_HOUR',
    overtimeThresholdWatts: 15,
    consumptionPollSeconds: 30,
    billingMode: 'PER_USE',
    pricePerUse: 0,
    pricePerKwh: 0,
    chargeNoShow: true,
    cancelDeadlineBeforeMinutes: 60,
    updatedByUserId: null,
    updatedAt: new Date(0).toISOString(),
};

const KEY_TO_VARIABLE: Record<
    Exclude<keyof UpdateSettingsInput, 'updatedByUserId'>,
    SettingsVariableName
> = {
    checkinWindowBeforeMinutes: 'CHECKIN_WINDOW_BEFORE_MINUTES',
    checkinWindowAfterMinutes: 'CHECKIN_WINDOW_AFTER_MINUTES',
    reservationDurationHours: 'RESERVATION_DURATION_HOURS',
    reservationStartMode: 'RESERVATION_START_MODE',
    overtimeThresholdWatts: 'OVERTIME_THRESHOLD_WATTS',
    consumptionPollSeconds: 'CONSUMPTION_POLL_SECONDS',
    billingMode: 'BILLING_MODE',
    pricePerUse: 'PRICE_PER_USE',
    pricePerKwh: 'PRICE_PER_KWH',
    chargeNoShow: 'CHARGE_NO_SHOW',
    cancelDeadlineBeforeMinutes: 'CANCEL_DEADLINE_BEFORE_MINUTES',
};

type UpdateSettingsInput = {
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
    cancelDeadlineBeforeMinutes?: number;
    updatedByUserId: string;
};

const toNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const selectLatestMetadata = (rows: Pick<SettingsVariableRecord, 'updated_by_user_id' | 'start_at'>[]) => {
    const latest = [...rows].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())[0];
    return {
        updatedByUserId: latest?.updated_by_user_id ?? null,
        updatedAt: latest?.start_at ?? SETTINGS_DEFAULTS.updatedAt,
    };
};

const mapRowsToView = (rows: SettingsVariableRecord[]): SystemSettingsView => {
    const metadata = selectLatestMetadata(rows);
    const byVariable = new Map<SettingsVariableName, SettingsVariableRecord>(
        rows.map((row) => [row.variable, row]),
    );

    const reservationStartModeValue = byVariable.get('RESERVATION_START_MODE')?.value;
    const reservationStartMode = reservationStartModeValue === 'ANY_TIME' || reservationStartModeValue === 'FULL_HOUR'
        ? reservationStartModeValue
        : SETTINGS_DEFAULTS.reservationStartMode;

    const billingModeValue = byVariable.get('BILLING_MODE')?.value;
    const billingMode = billingModeValue === 'PER_USE' || billingModeValue === 'PER_KWH'
        ? billingModeValue
        : SETTINGS_DEFAULTS.billingMode;

    const chargeNoShowValue = byVariable.get('CHARGE_NO_SHOW')?.value;
    const chargeNoShow = chargeNoShowValue === 'false' ? false : SETTINGS_DEFAULTS.chargeNoShow;

    return {
        checkinWindowBeforeMinutes: toNumber(
            byVariable.get('CHECKIN_WINDOW_BEFORE_MINUTES')?.value ?? '',
            SETTINGS_DEFAULTS.checkinWindowBeforeMinutes,
        ),
        checkinWindowAfterMinutes: toNumber(
            byVariable.get('CHECKIN_WINDOW_AFTER_MINUTES')?.value ?? '',
            SETTINGS_DEFAULTS.checkinWindowAfterMinutes,
        ),
        reservationDurationHours: toNumber(
            byVariable.get('RESERVATION_DURATION_HOURS')?.value ?? '',
            SETTINGS_DEFAULTS.reservationDurationHours,
        ),
        reservationStartMode,
        overtimeThresholdWatts: toNumber(
            byVariable.get('OVERTIME_THRESHOLD_WATTS')?.value ?? '',
            SETTINGS_DEFAULTS.overtimeThresholdWatts,
        ),
        consumptionPollSeconds: toNumber(
            byVariable.get('CONSUMPTION_POLL_SECONDS')?.value ?? '',
            SETTINGS_DEFAULTS.consumptionPollSeconds,
        ),
        billingMode,
        pricePerUse: toNumber(
            byVariable.get('PRICE_PER_USE')?.value ?? '',
            SETTINGS_DEFAULTS.pricePerUse,
        ),
        pricePerKwh: toNumber(
            byVariable.get('PRICE_PER_KWH')?.value ?? '',
            SETTINGS_DEFAULTS.pricePerKwh,
        ),
        chargeNoShow,
        cancelDeadlineBeforeMinutes: toNumber(
            byVariable.get('CANCEL_DEADLINE_BEFORE_MINUTES')?.value ?? '',
            SETTINGS_DEFAULTS.cancelDeadlineBeforeMinutes,
        ),
        ...metadata,
    };
};

const readActiveRows = async (): Promise<SettingsVariableRecord[]> => {
    const result = await db.query<SettingsVariableRecord>(
        `SELECT id,
                variable,
                value,
                start_at,
                end_at,
                updated_by_user_id,
                created_at
         FROM settings_variables
         WHERE end_at IS NULL`,
        [],
    );
    return result.rows;
};

const readRowsAsOf = async (dateTimeIso: string): Promise<SettingsVariableRecord[]> => {
    const result = await db.query<SettingsVariableRecord>(
        `SELECT DISTINCT ON (variable)
                id,
                variable,
                value,
                start_at,
                end_at,
                updated_by_user_id,
                created_at
         FROM settings_variables
         WHERE start_at <= $1
           AND (end_at IS NULL OR end_at > $1)
         ORDER BY variable, start_at DESC, created_at DESC`,
        [dateTimeIso],
    );
    return result.rows;
};

const setVariableValue = async (
    client: PoolClient,
    variable: SettingsVariableName,
    value: string,
    updatedByUserId: string,
    nowIso: string,
): Promise<void> => {
    await client.query(
        `UPDATE settings_variables
         SET end_at = $2
         WHERE variable = $1
           AND end_at IS NULL`,
        [variable, nowIso],
    );

    await client.query(
        `INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
         VALUES ($1, $2, $3, NULL, $4, $3)`,
        [variable, value, nowIso, updatedByUserId],
    );
};

export const systemSettingsRepository = {
    async get(): Promise<SystemSettingsView> {
        const rows = await readActiveRows();
        return mapRowsToView(rows);
    },

    async getAsOf(dateTimeIso: string): Promise<SystemSettingsView> {
        const rows = await readRowsAsOf(dateTimeIso);
        return mapRowsToView(rows);
    },

    async update(input: UpdateSettingsInput): Promise<SystemSettingsView> {
        const nowIso = new Date().toISOString();
        const entries = Object.entries(KEY_TO_VARIABLE) as Array<
            [Exclude<keyof UpdateSettingsInput, 'updatedByUserId'>, SettingsVariableName]
        >;
        const changed = entries
            .filter(([key]) => input[key] !== undefined)
            .map(([key, variable]) => ({
                variable,
                value: String(input[key]),
            }));

        if (changed.length === 0) {
            return this.get();
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const item of changed) {
                await setVariableValue(client, item.variable, item.value, input.updatedByUserId, nowIso);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        return this.get();
    },
};
