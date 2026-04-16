-- Soft delete para manutenções canceladas
ALTER TABLE machine_maintenances
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by_user_id UUID REFERENCES users(id);

-- Recria o índice parcial incluindo deleted_at IS NULL
DROP INDEX IF EXISTS idx_machine_maintenances_open;
CREATE INDEX idx_machine_maintenances_open ON machine_maintenances(machine_id)
    WHERE ended_at IS NULL AND deleted_at IS NULL;
