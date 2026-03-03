CREATE TABLE IF NOT EXISTS system_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    checkin_window_before_minutes INTEGER NOT NULL DEFAULT 15,
    checkin_window_after_minutes INTEGER NOT NULL DEFAULT 30,
    overtime_threshold_watts NUMERIC(10,2) NOT NULL DEFAULT 15,
    consumption_poll_seconds INTEGER NOT NULL DEFAULT 30,
    billing_mode VARCHAR(20) NOT NULL DEFAULT 'PER_USE' CHECK (billing_mode IN ('PER_USE', 'PER_KWH')),
    price_per_use NUMERIC(12,2) NOT NULL DEFAULT 0,
    price_per_kwh NUMERIC(12,4) NOT NULL DEFAULT 0,
    updated_by_user_id UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_system_settings_singleton CHECK (id = 1),
    CONSTRAINT chk_settings_non_negative_windows CHECK (checkin_window_before_minutes >= 0 AND checkin_window_after_minutes >= 0),
    CONSTRAINT chk_settings_non_negative_threshold CHECK (overtime_threshold_watts >= 0),
    CONSTRAINT chk_settings_positive_poll CHECK (consumption_poll_seconds > 0),
    CONSTRAINT chk_settings_non_negative_prices CHECK (price_per_use >= 0 AND price_per_kwh >= 0)
);

INSERT INTO system_settings (
    id,
    checkin_window_before_minutes,
    checkin_window_after_minutes,
    overtime_threshold_watts,
    consumption_poll_seconds,
    billing_mode,
    price_per_use,
    price_per_kwh
)
VALUES (1, 15, 30, 15, 30, 'PER_USE', 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL CHECK (type IN ('NO_SHOW', 'OVERTIME', 'FORCED_SHUTDOWN', 'TUYA_ERROR')),
    reservation_id UUID REFERENCES reservations(id),
    laundry_session_id UUID REFERENCES laundry_sessions(id),
    unit_id UUID REFERENCES units(id),
    user_id UUID REFERENCES users(id),
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competence CHAR(7) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    unit_id UUID REFERENCES units(id),
    billing_mode VARCHAR(20) NOT NULL CHECK (billing_mode IN ('PER_USE', 'PER_KWH')),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invoices_competence_format CHECK (competence ~ '^[0-9]{4}-[0-9]{2}$'),
    CONSTRAINT uq_invoices_competence_user_unit UNIQUE (competence, user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id),
    laundry_session_id UUID REFERENCES laundry_sessions(id),
    description TEXT NOT NULL,
    quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invoice_item_non_negative CHECK (quantity >= 0 AND unit_price >= 0 AND total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_reservation_id ON incidents(reservation_id);
CREATE INDEX IF NOT EXISTS idx_incidents_laundry_session_id ON incidents(laundry_session_id);

CREATE INDEX IF NOT EXISTS idx_invoices_competence ON invoices(competence);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_unit_id ON invoices(unit_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_reservation_id ON invoice_items(reservation_id);
