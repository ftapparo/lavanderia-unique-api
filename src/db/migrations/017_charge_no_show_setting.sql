-- Expande constraints para incluir CHARGE_NO_SHOW
ALTER TABLE settings_variables
    DROP CONSTRAINT chk_settings_variables_variable,
    ADD CONSTRAINT chk_settings_variables_variable
        CHECK (variable IN (
            'CHECKIN_WINDOW_BEFORE_MINUTES',
            'CHECKIN_WINDOW_AFTER_MINUTES',
            'RESERVATION_DURATION_HOURS',
            'RESERVATION_START_MODE',
            'OVERTIME_THRESHOLD_WATTS',
            'CONSUMPTION_POLL_SECONDS',
            'BILLING_MODE',
            'PRICE_PER_USE',
            'PRICE_PER_KWH',
            'CHARGE_NO_SHOW'
        ));

ALTER TABLE settings_variables
    DROP CONSTRAINT chk_settings_variables_value,
    ADD CONSTRAINT chk_settings_variables_value
        CHECK (
            (variable = 'BILLING_MODE' AND value IN ('PER_USE', 'PER_KWH'))
            OR
            (variable = 'RESERVATION_START_MODE' AND value IN ('ANY_TIME', 'FULL_HOUR'))
            OR
            (variable = 'CHARGE_NO_SHOW' AND value IN ('true', 'false'))
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
        );

-- Insere valor padrao
INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
VALUES ('CHARGE_NO_SHOW', 'true', NOW(), NULL, NULL, NOW());
