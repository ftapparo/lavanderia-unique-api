-- Adiciona CANCEL_DEADLINE_BEFORE_MINUTES em settings_variables
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
            'CHARGE_NO_SHOW',
            'CANCEL_DEADLINE_BEFORE_MINUTES'
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
                'PRICE_PER_KWH',
                'CANCEL_DEADLINE_BEFORE_MINUTES'
            ) AND value ~ '^-?[0-9]+(\.[0-9]+)?$')
        );

-- Valor padrão: cancelamento permitido até 60 minutos antes da reserva
INSERT INTO settings_variables (variable, value, start_at, end_at, updated_by_user_id, created_at)
VALUES ('CANCEL_DEADLINE_BEFORE_MINUTES', '60', NOW(), NULL, NULL, NOW());

-- Adiciona charge_type em invoice_items
ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS charge_type VARCHAR(16) NOT NULL DEFAULT 'USE';

ALTER TABLE invoice_items
    ADD CONSTRAINT chk_invoice_items_charge_type
        CHECK (charge_type IN ('USE', 'NO_SHOW'));
