-- Migration 014: PIN temporário separado da senha
-- Permite que usuários novos e redefinições usem PIN temporário
-- sem invalidar a senha existente do usuário

-- Tornar password_hash nullable: usuários recém-criados ainda não possuem senha
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Coluna pin_hash: armazena o hash do PIN temporário (primeiro acesso ou redefinição)
-- NULL = sem PIN ativo; preenchido = PIN válido aguardando uso
ALTER TABLE users ADD COLUMN pin_hash TEXT;
