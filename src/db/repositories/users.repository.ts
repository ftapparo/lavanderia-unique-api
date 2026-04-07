import { db } from '../pool';
import type { UserRecord, UserRole, UserView } from '../../types/domain.types';

type CreateUserInput = {
    name: string;
    cpf: string;
    email: string;
    phone?: string | null;
    passwordHash: string | null;
    pinHash?: string | null;
    role?: UserRole;
    cargo?: string | null;
    mustChangePassword?: boolean;
    profilePhotoBuffer?: Buffer | null;
    profilePhotoMime?: string | null;
};

type UpdateUserInput = {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: UserRole;
    cargo?: string | null;
    profilePhotoBuffer?: Buffer | null;
    profilePhotoMime?: string | null;
};

const USER_COLUMNS = `id, name, cpf, email, phone, password_hash, pin_hash, role, cargo, must_change_password, profile_photo, profile_photo_mime, created_at, updated_at`;

type ListUsersFilters = {
    q?: string;
    unitId?: string;
    slotPosition?: 1 | 2 | 3;
    profile?: string;
};

export const usersRepository = {
    async create(input: CreateUserInput): Promise<UserRecord> {
        const result = await db.query<UserRecord>(
            `INSERT INTO users (name, cpf, email, phone, password_hash, pin_hash, role, cargo, must_change_password, profile_photo, profile_photo_mime)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING ${USER_COLUMNS}`,
            [
                input.name,
                input.cpf,
                input.email,
                input.phone ?? null,
                input.passwordHash ?? null,
                input.pinHash ?? null,
                input.role ?? 'USER',
                input.cargo ?? null,
                input.mustChangePassword ?? false,
                input.profilePhotoBuffer ?? null,
                input.profilePhotoMime ?? null,
            ],
        );

        return result.rows[0];
    },

    async findByEmail(email: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 LIMIT 1`,
            [email],
        );

        return result.rows[0] || null;
    },

    async findByCpf(cpf: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT ${USER_COLUMNS} FROM users WHERE cpf = $1 LIMIT 1`,
            [cpf],
        );

        return result.rows[0] || null;
    },

    async findById(id: string): Promise<UserRecord | null> {
        const result = await db.query<UserRecord>(
            `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
            [id],
        );

        return result.rows[0] || null;
    },

    async update(id: string, input: UpdateUserInput): Promise<UserRecord | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
        if (input.email !== undefined) { fields.push(`email = $${idx++}`); values.push(input.email); }
        if (input.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(input.phone); }
        if (input.role !== undefined) { fields.push(`role = $${idx++}`); values.push(input.role); }
        if (input.cargo !== undefined) { fields.push(`cargo = $${idx++}`); values.push(input.cargo); }
        if (input.profilePhotoBuffer !== undefined) {
            fields.push(`profile_photo = $${idx++}`);
            values.push(input.profilePhotoBuffer);
            fields.push(`profile_photo_mime = $${idx++}`);
            values.push(input.profilePhotoMime ?? null);
        }

        if (fields.length === 0) return usersRepository.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query<UserRecord>(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${USER_COLUMNS}`,
            values,
        );

        return result.rows[0] || null;
    },

    async setPasswordHash(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
        await db.query(
            `UPDATE users SET password_hash = $1, pin_hash = NULL, must_change_password = $2, updated_at = NOW() WHERE id = $3`,
            [passwordHash, mustChangePassword, id],
        );
    },

    async setPin(id: string, pinHash: string): Promise<void> {
        await db.query(
            `UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2`,
            [pinHash, id],
        );
    },

    async clearPin(id: string): Promise<void> {
        await db.query(
            `UPDATE users SET pin_hash = NULL, updated_at = NOW() WHERE id = $1`,
            [id],
        );
    },

    async setMustChangePassword(id: string, value: boolean): Promise<void> {
        await db.query(
            `UPDATE users SET must_change_password = $1, updated_at = NOW() WHERE id = $2`,
            [value, id],
        );
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await db.query(`DELETE FROM users WHERE id = $1`, [id]);
        return (result.rowCount ?? 0) > 0;
    },

    async listAll(filters?: ListUsersFilters): Promise<UserView[]> {
        const values: unknown[] = [];
        const where: string[] = [];
        let idx = 1;

        const qRaw = filters?.q?.trim();
        if (qRaw) {
            const qDigits = qRaw.replace(/\D/g, '');
            if (qDigits) {
                where.push(`(
                    name ILIKE $${idx}
                    OR cpf ILIKE $${idx}
                    OR cpf LIKE $${idx + 1}
                )`);
                values.push(`%${qRaw}%`, `%${qDigits}%`);
                idx += 2;
            } else {
                where.push(`name ILIKE $${idx}`);
                values.push(`%${qRaw}%`);
                idx += 1;
            }
        }

        if (filters?.unitId) {
            where.push(`NOT EXISTS (
                SELECT 1
                FROM unit_memberships m
                WHERE m.user_id = users.id
                  AND m.unit_id = $${idx}
                  AND m.active = true
                  AND m.start_date <= CURRENT_DATE
                  AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
            )`);
            values.push(filters.unitId);
            idx += 1;
        }

        if (filters?.profile === 'LOCATARIO' && filters.unitId) {
            where.push(`NOT EXISTS (
                SELECT 1
                FROM unit_memberships m2
                WHERE m2.user_id = users.id
                  AND m2.profile = 'LOCATARIO'
                  AND m2.active = true
                  AND m2.unit_id <> $${idx}
                  AND m2.start_date <= CURRENT_DATE
                  AND (m2.end_date IS NULL OR m2.end_date >= CURRENT_DATE)
            )`);
            values.push(filters.unitId);
            idx += 1;
        }

        const query = `SELECT id, name, cpf, email, phone, role, cargo, must_change_password, created_at,
                              (profile_photo IS NOT NULL) AS has_profile_photo
             FROM users
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY name`;

        const result = await db.query<{
            id: string;
            name: string;
            cpf: string;
            email: string;
            phone: string | null;
            role: UserRole;
            cargo: string | null;
            must_change_password: boolean;
            created_at: string;
            has_profile_photo: boolean;
        }>(
            query,
            values,
        );

        return result.rows.map((r) => ({
            id: r.id,
            name: r.name,
            cpf: r.cpf,
            email: r.email,
            phone: r.phone,
            role: r.role,
            cargo: r.cargo,
            mustChangePassword: r.must_change_password,
            hasProfilePhoto: r.has_profile_photo,
            createdAt: r.created_at,
        }));
    },

    async hasActiveReservations(userId: string): Promise<boolean> {
        const result = await db.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM reservations
             WHERE user_id = $1 AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')`,
            [userId],
        );
        return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
    },
};
