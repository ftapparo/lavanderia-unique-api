CREATE SEQUENCE IF NOT EXISTS machines_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS number INTEGER,
ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
ADD COLUMN IF NOT EXISTS model VARCHAR(120);

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM machines
)
UPDATE machines m
SET number = o.rn
FROM ordered o
WHERE m.id = o.id
  AND m.number IS NULL;

UPDATE machines
SET brand = COALESCE(NULLIF(TRIM(brand), ''), 'SEM_MARCA'),
    model = COALESCE(NULLIF(TRIM(model), ''), 'SEM_MODELO');

SELECT setval(
    'machines_number_seq',
    COALESCE((SELECT MAX(number) FROM machines), 1),
    COALESCE((SELECT MAX(number) FROM machines), 0) > 0
);

ALTER TABLE machines
ALTER COLUMN number SET DEFAULT nextval('machines_number_seq'),
ALTER COLUMN number SET NOT NULL,
ALTER COLUMN brand SET NOT NULL,
ALTER COLUMN model SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_machines_number'
    ) THEN
        ALTER TABLE machines
        ADD CONSTRAINT uq_machines_number UNIQUE (number);
    END IF;
END $$;

ALTER TABLE machines
DROP CONSTRAINT IF EXISTS machines_unit_id_fkey;

DROP INDEX IF EXISTS idx_machines_unit_id;

ALTER TABLE machines
DROP COLUMN IF EXISTS unit_id;
