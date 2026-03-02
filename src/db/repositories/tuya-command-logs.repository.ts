import { db } from '../pool';
import type { TuyaCommandLogRecord } from '../../types/domain.types';

export const tuyaCommandLogsRepository = {
    async create(input: {
        laundrySessionId?: string | null;
        reservationId?: string | null;
        machineId?: string | null;
        deviceId: string;
        command: string;
        success: boolean;
        requestPayload?: Record<string, unknown>;
        responsePayload?: Record<string, unknown>;
        errorMessage?: string | null;
    }): Promise<TuyaCommandLogRecord> {
        const result = await db.query<TuyaCommandLogRecord>(
            `INSERT INTO tuya_command_logs (
                laundry_session_id,
                reservation_id,
                machine_id,
                device_id,
                command,
                success,
                request_payload,
                response_payload,
                error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
            RETURNING id, laundry_session_id, reservation_id, machine_id, device_id, command, success, request_payload, response_payload, error_message, created_at`,
            [
                input.laundrySessionId ?? null,
                input.reservationId ?? null,
                input.machineId ?? null,
                input.deviceId,
                input.command,
                input.success,
                JSON.stringify(input.requestPayload ?? {}),
                JSON.stringify(input.responsePayload ?? {}),
                input.errorMessage ?? null,
            ],
        );

        return result.rows[0];
    },
};
