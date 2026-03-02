CREATE SEQUENCE IF NOT EXISTS units_code_seq START WITH 1 INCREMENT BY 1;

SELECT setval(
    'units_code_seq',
    COALESCE(
        (SELECT MAX(code::BIGINT) FROM units WHERE code ~ '^[0-9]+$'),
        1
    ),
    COALESCE(
        (SELECT MAX(code::BIGINT) FROM units WHERE code ~ '^[0-9]+$'),
        0
    ) > 0
);

ALTER TABLE units
ADD COLUMN IF NOT EXISTS floor INTEGER,
ADD COLUMN IF NOT EXISTS unit_number INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_units_floor_non_negative'
    ) THEN
        ALTER TABLE units
        ADD CONSTRAINT chk_units_floor_non_negative CHECK (floor IS NULL OR floor >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_units_unit_number_positive'
    ) THEN
        ALTER TABLE units
        ADD CONSTRAINT chk_units_unit_number_positive CHECK (unit_number IS NULL OR unit_number > 0);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_units_floor_unit_number
    ON units(floor, unit_number)
    WHERE floor IS NOT NULL AND unit_number IS NOT NULL;
