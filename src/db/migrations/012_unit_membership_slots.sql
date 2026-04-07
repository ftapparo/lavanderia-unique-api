CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE unit_memberships
    ADD COLUMN IF NOT EXISTS slot_position SMALLINT;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY unit_id
            ORDER BY CASE profile
                WHEN 'PROPRIETARIO' THEN 1
                WHEN 'ADMINISTRADOR' THEN 2
                WHEN 'LOCATARIO' THEN 3
                WHEN 'HOSPEDE' THEN 4
                WHEN 'SUPER' THEN 5
                ELSE 99
            END,
            start_date ASC,
            created_at ASC,
            id ASC
        ) AS rn
    FROM unit_memberships
    WHERE active = true
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
)
UPDATE unit_memberships m
SET slot_position = CASE
        WHEN ranked.rn <= 3 THEN ranked.rn::smallint
        ELSE 3
    END,
    active = CASE
        WHEN ranked.rn > 3 THEN false
        ELSE m.active
    END,
    end_date = CASE
        WHEN ranked.rn > 3 AND (m.end_date IS NULL OR m.end_date > CURRENT_DATE) THEN CURRENT_DATE
        ELSE m.end_date
    END,
    updated_at = NOW()
FROM ranked
WHERE ranked.id = m.id;

UPDATE unit_memberships
SET slot_position = CASE
    WHEN profile = 'PROPRIETARIO' THEN 1
    WHEN profile IN ('ADMINISTRADOR', 'LOCATARIO') THEN 2
    WHEN profile IN ('HOSPEDE', 'SUPER') THEN 3
    ELSE 2
END
WHERE slot_position IS NULL;

ALTER TABLE unit_memberships
    ALTER COLUMN slot_position SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_unit_memberships_slot_position'
    ) THEN
        ALTER TABLE unit_memberships
            ADD CONSTRAINT chk_unit_memberships_slot_position
            CHECK (slot_position BETWEEN 1 AND 3);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ex_unit_memberships_unit_slot_period'
    ) THEN
        ALTER TABLE unit_memberships
            ADD CONSTRAINT ex_unit_memberships_unit_slot_period
            EXCLUDE USING gist (
                unit_id WITH =,
                slot_position WITH =,
                daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
            )
            WHERE (active = true);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_unit_memberships_unit_slot
    ON unit_memberships (unit_id, slot_position);
