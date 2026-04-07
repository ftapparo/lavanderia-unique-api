import { db } from '../src/db/pool';
import { hashPassword } from '../src/utils/password';

const SUPER_ADMIN = {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'SUPER ADMIN',
    cpf: '00000000000',
    email: 'admin@admin',
    phone: '00000000000',
    role: 'SUPER' as const,
    password: '123456',
};

export async function runProdSeed(): Promise<void> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO users (id, name, cpf, email, phone, password_hash, role, cargo, must_change_password)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name,
                 cpf = EXCLUDED.cpf,
                 email = EXCLUDED.email,
                 phone = EXCLUDED.phone,
                 password_hash = EXCLUDED.password_hash,
                 role = EXCLUDED.role,
                 cargo = EXCLUDED.cargo,
                 must_change_password = EXCLUDED.must_change_password,
                 updated_at = NOW()`,
            [
                SUPER_ADMIN.id,
                SUPER_ADMIN.name,
                SUPER_ADMIN.cpf,
                SUPER_ADMIN.email,
                SUPER_ADMIN.phone,
                hashPassword(SUPER_ADMIN.password),
                SUPER_ADMIN.role,
                'SUPER ADMIN',
                true,
            ],
        );

        await client.query('COMMIT');
        console.log('[seed] Production seed aplicado. Super admin criado/atualizado.');
        console.log(`[seed] Login: ${SUPER_ADMIN.email} | Senha padrao: ${SUPER_ADMIN.password}`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

