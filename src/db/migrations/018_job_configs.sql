CREATE TABLE IF NOT EXISTS job_configs (
    name            VARCHAR(64) PRIMARY KEY,
    cron_expression VARCHAR(128) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    need_update     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO job_configs (name, cron_expression, active, need_update)
VALUES
    ('no-show-detector',        '*/2 * * * *', TRUE, FALSE),
    ('reservation-end-handler', '* * * * *',   TRUE, FALSE),
    ('overtime-monitor',        '* * * * *',   TRUE, FALSE),
    ('monthly-billing-generator','5 0 1 * *',  TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;
