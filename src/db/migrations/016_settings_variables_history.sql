CREATE TABLE IF NOT EXISTS settings_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variable VARCHAR(64) NOT NULL,
    value TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ NULL,
    updated_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_settings_variables_variable
        CHECK (variable IN (
            'CHECKIN_WINDOW_BEFORE_MINUTES',
            'CHECKIN_WINDOW_AFTER_MINUTES',
            'RESERVATION_DURATION_HOURS',
            'RESERVATION_START_MODE',
            'OVERTIME_THRESHOLD_WATTS',
            'CONSUMPTION_POLL_SECONDS',
            'BILLING_MODE',
            'PRICE_PER_USE',
            'PRICE_PER_KWH'
        )),
    CONSTRAINT chk_settings_variables_period
        CHECK (end_at IS NULL OR end_at > start_at),
    CONSTRAINT chk_settings_variables_value
        CHECK (
            (variable = 'BILLING_MODE' AND value IN ('PER_USE', 'PER_KWH'))
            OR
            (variable = 'RESERVATION_START_MODE' AND value IN ('ANY_TIME', 'FULL_HOUR'))
            OR
            (variable IN (
                'CHECKIN_WINDOW_BEFORE_MINUTES',
                'CHECKIN_WINDOW_AFTER_MINUTES',
                'RESERVATION_DURATION_HOURS',
                'OVERTIME_THRESHOLD_WATTS',
                'CONSUMPTION_POLL_SECONDS',
                'PRICE_PER_USE',
                'PRICE_PER_KWH'
            ) AND value ~ '^-?[0-9]+(\.[0-9]+)?$')
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_variables_active_by_variable
    ON settings_variables (variable)
    WHERE end_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_settings_variables_lookup
    ON settings_variables (variable, start_at DESC, end_at);

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'CHECKIN_WINDOW_BEFORE_MINUTES', checkin_window_before_minutes::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'CHECKIN_WINDOW_AFTER_MINUTES', checkin_window_after_minutes::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'RESERVATION_DURATION_HOURS', reservation_duration_hours::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'RESERVATION_START_MODE', reservation_start_mode::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'OVERTIME_THRESHOLD_WATTS', overtime_threshold_watts::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'CONSUMPTION_POLL_SECONDS', consumption_poll_seconds::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'BILLING_MODE', billing_mode::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'PRICE_PER_USE', price_per_use::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
SELECT 'PRICE_PER_KWH', price_per_kwh::text, NOW(), NULL, updated_by_user_id, NOW()
FROM system_settings
WHERE id = 1
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    check_name TEXT;
BEGIN
    FOR check_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'invoices'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%billing_mode%'
    LOOP
        EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS %I', check_name);
    END LOOP;
END $$;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_billing_mode
        CHECK (billing_mode IN ('PER_USE', 'PER_KWH', 'MIXED'));

DROP TABLE IF EXISTS system_settings;
