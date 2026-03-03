import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

type TuyaCommand = 'TURN_ON' | 'TURN_OFF';

export type TuyaDeviceStatus = {
    deviceId: string;
    isOn: boolean;
};

export type TuyaDeviceConsumption = {
    deviceId: string;
    powerWatts: number;
    energyKwh: number;
    sampledAt: string;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};

const callWithRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= env.tuyaRetryAttempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt >= env.tuyaRetryAttempts) {
                break;
            }
            const backoffMs = env.tuyaRetryBaseDelayMs * (2 ** (attempt - 1));
            await delay(backoffMs);
        }
    }
    throw lastError;
};

const commandMock = async (deviceId: string, command: TuyaCommand): Promise<{ deviceId: string; command: TuyaCommand; mocked: boolean }> => {
    return {
        deviceId,
        command,
        mocked: true,
    };
};

const statusMock = async (deviceId: string): Promise<TuyaDeviceStatus> => {
    return {
        deviceId,
        isOn: true,
    };
};

const consumptionMock = async (deviceId: string): Promise<TuyaDeviceConsumption> => {
    return {
        deviceId,
        powerWatts: 0,
        energyKwh: 0,
        sampledAt: new Date().toISOString(),
    };
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
    const execute = async (): Promise<T> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.tuyaTimeoutMs);
        try {
            const response = await fetch(`${env.tuyaServiceBaseUrl}${path}`, {
                ...init,
                signal: controller.signal,
                headers: {
                    'content-type': 'application/json',
                    ...(init.headers || {}),
                },
            });

            const payload = await getJson(response);

            if (!response.ok) {
                throw new AppError('Falha ao executar comando no servico Tuya.', 502, payload);
            }

            const envelope = payload as { data?: T; message?: string | null; errors?: unknown | null };
            return envelope.data as T;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            const isAbort = error instanceof Error && error.name === 'AbortError';
            throw new AppError(
                isAbort ? 'Timeout ao acessar servico Tuya.' : 'Servico Tuya indisponivel.',
                502,
                {
                    code: isAbort ? 'TUYA_TIMEOUT' : 'TUYA_UNAVAILABLE',
                    cause: error instanceof Error ? error.message : error,
                },
            );
        } finally {
            clearTimeout(timeout);
        }
    };

    return callWithRetry(execute);
};

export const tuyaClient = {
    async health() {
        if (env.tuyaMockMode) {
            return {
                status: 'ok',
                mocked: true,
            };
        }

        return request<{ status: string; environment?: string }>(
            '/v1/api/health',
            { method: 'GET' },
        );
    },

    async turnOn(deviceId: string) {
        if (env.tuyaMockMode) {
            return commandMock(deviceId, 'TURN_ON');
        }

        return request<{ deviceId: string; command: TuyaCommand; mocked: boolean }>(
            `/v1/api/devices/${encodeURIComponent(deviceId)}/turn-on`,
            { method: 'POST', body: '{}' },
        );
    },

    async turnOff(deviceId: string) {
        if (env.tuyaMockMode) {
            return commandMock(deviceId, 'TURN_OFF');
        }

        return request<{ deviceId: string; command: TuyaCommand; mocked: boolean }>(
            `/v1/api/devices/${encodeURIComponent(deviceId)}/turn-off`,
            { method: 'POST', body: '{}' },
        );
    },

    async getStatus(deviceId: string): Promise<TuyaDeviceStatus> {
        if (env.tuyaMockMode) {
            return statusMock(deviceId);
        }

        return request<TuyaDeviceStatus>(
            `/v1/api/devices/${encodeURIComponent(deviceId)}/status`,
            { method: 'GET' },
        );
    },

    async getConsumption(deviceId: string): Promise<TuyaDeviceConsumption> {
        if (env.tuyaMockMode) {
            return consumptionMock(deviceId);
        }

        return request<TuyaDeviceConsumption>(
            `/v1/api/devices/${encodeURIComponent(deviceId)}/consumption`,
            { method: 'GET' },
        );
    },
};
