CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    email VARCHAR(160) NOT NULL UNIQUE,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    cargo VARCHAR(60),
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS units_code_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    floor INTEGER,
    unit_number INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    allow_guest_reservations BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_units_floor_non_negative'
    ) THEN
        ALTER TABLE units
            ADD CONSTRAINT chk_units_floor_non_negative
            CHECK (floor IS NULL OR floor >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_units_unit_number_positive'
    ) THEN
        ALTER TABLE units
            ADD CONSTRAINT chk_units_unit_number_positive
            CHECK (unit_number IS NULL OR unit_number > 0);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_units_floor_unit_number
    ON units(floor, unit_number)
    WHERE floor IS NOT NULL AND unit_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_active ON units(active);

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

CREATE TABLE IF NOT EXISTS unit_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    slot_position SMALLINT NOT NULL DEFAULT 1,
    profile VARCHAR(40) NOT NULL REFERENCES membership_profiles(code),
    start_date DATE NOT NULL,
    end_date DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_unit_memberships_slot_position'
    ) THEN
        ALTER TABLE unit_memberships
            ADD CONSTRAINT chk_unit_memberships_slot_position
            CHECK (slot_position BETWEEN 1 AND 3);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ex_unit_memberships_unit_slot_period'
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_locatario_active_per_unit
ON unit_memberships (unit_id)
WHERE profile = 'LOCATARIO' AND active = true AND end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_unit_memberships_user_id ON unit_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_unit_memberships_unit_id ON unit_memberships(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_memberships_unit_slot ON unit_memberships(unit_id, slot_position);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id),
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(80) NOT NULL,
    entity_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
