ALTER TABLE machine_pairs
DROP CONSTRAINT IF EXISTS uq_machine_pairs_name;

ALTER TABLE machine_pairs
ADD CONSTRAINT uq_machine_pairs_name UNIQUE (name);

ALTER TABLE machine_pairs
DROP CONSTRAINT IF EXISTS machine_pairs_unit_id_fkey;

DROP INDEX IF EXISTS idx_machine_pairs_unit_id;

ALTER TABLE machine_pairs
DROP COLUMN IF EXISTS unit_id;
