-- Machine status enum
CREATE TYPE machine_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- Add status column to machines (replaces active boolean for fine-grained control)
ALTER TABLE machines
    ADD COLUMN status machine_status NOT NULL DEFAULT 'ACTIVE';

-- Sync existing data: inactive machines get INACTIVE status
UPDATE machines SET status = 'INACTIVE' WHERE active = false;

-- Maintenance history table
CREATE TABLE machine_maintenances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID NOT NULL REFERENCES machines(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    problem         TEXT NOT NULL,
    solution        TEXT,
    created_by_user_id UUID REFERENCES users(id),
    closed_by_user_id  UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_maintenance_ended_after_started CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX idx_machine_maintenances_machine_id ON machine_maintenances(machine_id);
CREATE INDEX idx_machine_maintenances_open ON machine_maintenances(machine_id) WHERE ended_at IS NULL;
