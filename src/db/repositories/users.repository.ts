import { db } from '../pool';
import type { UserRecord, UserRole } from '../../types/domain.types';

type CreateUserInput = {
    name: string;
    cpf: string;
    email: string;
    phone?: string | null;
    passwordHash: string;
    role?: UserRole;
};

export const usersRepository = {
    async create(input: CreateUserInput): Promise<UserRecord> {
        const result = await db.query<UserRecord>(
            `INSERT INTO users (name, cpf, email, phone, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, cpf, email, phone, password_hash, role, created_at, updated_at`,
            [input.name, input.cpf, input.email, input.phone ?? null, input.passwordHash, input.role ?? 'USER'],
        );

        return result.rows[0];
    },

    async findByEmail(email: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT id, name, cpf, email, phone, password_hash, role, created_at, updated_at
             FROM users WHERE email = $1 LIMIT 1`,
            [email],
        );

        return result.rows[0] || null;
    },

    async findByCpf(cpf: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT id, name, cpf, email, phone, password_hash, role, created_at, updated_at
             FROM users WHERE cpf = $1 LIMIT 1`,
            [cpf],
        );

        return result.rows[0] || null;
    },

    async findById(id: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT id, name, cpf, email, phone, password_hash, role, created_at, updated_at
             FROM users WHERE id = $1 LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },
};
