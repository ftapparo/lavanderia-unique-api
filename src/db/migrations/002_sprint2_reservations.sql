CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    name VARCHAR(120) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('WASHER', 'DRYER')),
    tuya_device_id VARCHAR(120),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    name VARCHAR(120) NOT NULL,
    washer_machine_id UUID NOT NULL REFERENCES machines(id),
    dryer_machine_id UUID NOT NULL REFERENCES machines(id),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_machine_pairs_distinct CHECK (washer_machine_id <> dryer_machine_id),
    CONSTRAINT uq_machine_pairs_name UNIQUE (unit_id, name),
    CONSTRAINT uq_machine_pairs_washer UNIQUE (washer_machine_id),
    CONSTRAINT uq_machine_pairs_dryer UNIQUE (dryer_machine_id)
);

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    machine_pair_id UUID NOT NULL REFERENCES machine_pairs(id),
    user_id UUID NOT NULL REFERENCES users(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELED', 'IN_PROGRESS', 'FINISHED')),
    canceled_at TIMESTAMPTZ,
    canceled_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reservations_fixed_two_hours CHECK (end_at = (start_at + INTERVAL '2 hour')),
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
        machine_pair_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'))
);

CREATE INDEX IF NOT EXISTS idx_machines_unit_id ON machines(unit_id);
CREATE INDEX IF NOT EXISTS idx_machine_pairs_unit_id ON machine_pairs(unit_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_machine_pair_id ON reservations(machine_pair_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
