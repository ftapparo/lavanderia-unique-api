ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS reservation_duration_hours INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS reservation_start_mode VARCHAR(20) NOT NULL DEFAULT 'FULL_HOUR';

UPDATE system_settings
SET reservation_duration_hours = COALESCE(reservation_duration_hours, 2),
    reservation_start_mode = COALESCE(reservation_start_mode, 'FULL_HOUR')
WHERE id = 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_system_settings_positive_reservation_duration'
    ) THEN
        ALTER TABLE system_settings
            ADD CONSTRAINT chk_system_settings_positive_reservation_duration
            CHECK (reservation_duration_hours > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_system_settings_reservation_start_mode'
    ) THEN
        ALTER TABLE system_settings
            ADD CONSTRAINT chk_system_settings_reservation_start_mode
            CHECK (reservation_start_mode IN ('ANY_TIME', 'FULL_HOUR'));
    END IF;
END $$;

ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS chk_reservations_fixed_two_hours;
