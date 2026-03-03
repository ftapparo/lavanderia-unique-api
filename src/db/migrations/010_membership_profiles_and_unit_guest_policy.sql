CREATE TABLE IF NOT EXISTS membership_profiles (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO membership_profiles (code, name, description)
VALUES
    ('PROPRIETARIO', 'Proprietario', 'Dono da unidade. Pode possuir uma ou mais unidades.'),
    ('LOCATARIO', 'Locatario', 'Ocupante por contrato de locacao.'),
    ('HOSPEDE', 'Hospede', 'Hospede temporario com periodo definido.'),
    ('ADMINISTRADOR', 'Administrador', 'Responsavel por gerir unidades em nome do proprietario.'),
    ('SUPER', 'Super', 'Usuario com acesso global ao sistema.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

UPDATE unit_memberships
SET profile = 'PROPRIETARIO'
WHERE profile = 'MORADOR';

UPDATE unit_memberships
SET profile = 'PROPRIETARIO'
WHERE profile NOT IN ('PROPRIETARIO', 'LOCATARIO', 'HOSPEDE', 'ADMINISTRADOR', 'SUPER');

ALTER TABLE units
    ADD COLUMN IF NOT EXISTS allow_guest_reservations BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'unit_memberships'
          AND constraint_name = 'fk_unit_memberships_profile'
    ) THEN
        ALTER TABLE unit_memberships
            ADD CONSTRAINT fk_unit_memberships_profile
            FOREIGN KEY (profile) REFERENCES membership_profiles(code);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_locatario_active_per_unit
ON unit_memberships (unit_id)
WHERE profile = 'LOCATARIO' AND active = true AND end_date IS NULL;
