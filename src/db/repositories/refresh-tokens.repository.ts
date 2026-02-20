import { createHash } from 'crypto';
import { db } from '../pool';
import type { RefreshTokenRecord } from '../../types/domain.types';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const refreshTokensRepository = {
    hashToken,

    async create(userId: string, rawToken: string, expiresAt: Date): Promise<RefreshTokenRecord> {
        const result = await db.query<RefreshTokenRecord>(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at`,
            [userId, hashToken(rawToken), expiresAt.toISOString()],
        );

        return result.rows[0];
    },

    async findActive(rawToken: string): Promise<RefreshTokenRecord | null> {
        const result = await db.query<RefreshTokenRecord>(
            `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
             FROM refresh_tokens
             WHERE token_hash = $1
               AND revoked_at IS NULL
               AND expires_at > NOW()
             LIMIT 1`,
            [hashToken(rawToken)],
        );

        return result.rows[0] || null;
    },

    async revokeById(id: string): Promise<void> {
        await db.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
            [id],
        );
    },
};
