-- Migration 011: Add admin-managed user fields
-- cargo: position/role for ADMIN and SUPER users (gerente, sindico, zelador, porteiro, etc.)
-- must_change_password: flag set when admin creates or resets a user's password

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS cargo VARCHAR(60),
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
