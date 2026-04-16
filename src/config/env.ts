export type BillingMode = 'PER_USE' | 'PER_KWH';

const read = (value: string | undefined, fallback: string): string => {
    const normalized = (value || '').trim();
    return normalized || fallback;
};

const readNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readOptional = (value: string | undefined): string | undefined => {
    const normalized = (value || '').trim();
    return normalized || undefined;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return fallback;
};

export const env = {
    nodeEnv: read(process.env.NODE_ENV, 'development'),
    port: readNumber(process.env.PORT, 3000),
    databaseUrl: read(process.env.DATABASE_URL, 'postgres://unique_db_user:change-me@localhost:5432/unique_db'),
    jwtSecret: read(process.env.JWT_SECRET, 'change-me'),
    jwtAccessTtlSeconds: readNumber(process.env.JWT_ACCESS_TTL_SECONDS, 3600),
    jwtRefreshTtlSeconds: readNumber(process.env.JWT_REFRESH_TTL_SECONDS, 60 * 60 * 24 * 30),
    checkinWindowBeforeMinutes: readNumber(process.env.CHECKIN_WINDOW_BEFORE_MINUTES, 15),
    checkinWindowAfterMinutes: readNumber(process.env.CHECKIN_WINDOW_AFTER_MINUTES, 30),
    billingMode: read(process.env.BILLING_MODE, 'PER_USE') as BillingMode,
    pricePerUse: readNumber(process.env.PRICE_PER_USE, 0),
    pricePerKwh: readNumber(process.env.PRICE_PER_KWH, 0),
    tuyaServiceBaseUrl: read(process.env.TUYA_SERVICE_BASE_URL, 'http://localhost:3001'),
    tuyaMockMode: readBoolean(process.env.TUYA_MOCK_MODE, true),
    tuyaTimeoutMs: readNumber(process.env.TUYA_TIMEOUT_MS, 5000),
    tuyaRetryAttempts: readNumber(process.env.TUYA_RETRY_ATTEMPTS, 3),
    tuyaRetryBaseDelayMs: readNumber(process.env.TUYA_RETRY_BASE_DELAY_MS, 250),
    httpsEnabled: readBoolean(process.env.HTTPS_ENABLED, false),
    httpsPort: readNumber(process.env.HTTPS_PORT, 3443),
    httpsKeyFile: readOptional(process.env.HTTPS_KEY_FILE),
    httpsCertFile: readOptional(process.env.HTTPS_CERT_FILE),
    httpsCaFile: readOptional(process.env.HTTPS_CA_FILE),
};
