CREATE TABLE IF NOT EXISTS laundry_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    machine_pair_id UUID NOT NULL REFERENCES machine_pairs(id),
    user_id UUID NOT NULL REFERENCES users(id),
    checkin_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FINISHED', 'FORCED_FINISHED')),
    overtime_started_at TIMESTAMPTZ,
    overtime_ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_laundry_sessions_reservation UNIQUE (reservation_id)
);

CREATE TABLE IF NOT EXISTS consumption_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laundry_session_id UUID NOT NULL REFERENCES laundry_sessions(id),
    machine_id UUID NOT NULL REFERENCES machines(id),
    sample_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    power_watts NUMERIC(12,3) NOT NULL DEFAULT 0,
    energy_kwh NUMERIC(12,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tuya_command_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laundry_session_id UUID REFERENCES laundry_sessions(id),
    reservation_id UUID REFERENCES reservations(id),
    machine_id UUID REFERENCES machines(id),
    device_id VARCHAR(120) NOT NULL,
    command VARCHAR(40) NOT NULL,
    success BOOLEAN NOT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laundry_sessions_reservation_id ON laundry_sessions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_laundry_sessions_machine_pair_id ON laundry_sessions(machine_pair_id);
CREATE INDEX IF NOT EXISTS idx_laundry_sessions_user_id ON laundry_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_laundry_sessions_status ON laundry_sessions(status);

CREATE INDEX IF NOT EXISTS idx_consumption_samples_session_id ON consumption_samples(laundry_session_id);
CREATE INDEX IF NOT EXISTS idx_consumption_samples_machine_id ON consumption_samples(machine_id);
CREATE INDEX IF NOT EXISTS idx_consumption_samples_sample_at ON consumption_samples(sample_at);

CREATE INDEX IF NOT EXISTS idx_tuya_command_logs_session_id ON tuya_command_logs(laundry_session_id);
CREATE INDEX IF NOT EXISTS idx_tuya_command_logs_reservation_id ON tuya_command_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_tuya_command_logs_machine_id ON tuya_command_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_tuya_command_logs_created_at ON tuya_command_logs(created_at);
