export type BillingMode = 'PER_USE' | 'PER_KWH';

const read = (value: string | undefined, fallback: string): string => {
    const normalized = (value || '').trim();
    return normalized || fallback;
};

const readNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
    nodeEnv: read(process.env.NODE_ENV, 'development'),
    port: readNumber(process.env.PORT, 3000),
    databaseUrl: read(process.env.DATABASE_URL, 'postgres://unique_db_user:change-me@localhost:5432/unique_db'),
    jwtSecret: read(process.env.JWT_SECRET, 'change-me'),
    jwtAccessTtlSeconds: readNumber(process.env.JWT_ACCESS_TTL_SECONDS, 3600),
    jwtRefreshTtlSeconds: readNumber(process.env.JWT_REFRESH_TTL_SECONDS, 60 * 60 * 24 * 30),
    checkinToleranceMinutes: readNumber(process.env.CHECKIN_TOLERANCE_MINUTES, 30),
    billingMode: read(process.env.BILLING_MODE, 'PER_USE') as BillingMode,
    pricePerUse: readNumber(process.env.PRICE_PER_USE, 0),
    pricePerKwh: readNumber(process.env.PRICE_PER_KWH, 0),
};
