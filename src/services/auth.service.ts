import { env } from '../config/env';
import type { UserRecord } from '../types/domain.types';
import { AppError } from '../utils/app-error';
import { signJwt } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { usersRepository } from '../db/repositories/users.repository';
import { refreshTokensRepository } from '../db/repositories/refresh-tokens.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';

export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        name: string;
        cpf: string;
        email: string;
        phone: string | null;
        role: string;
    };
};

const sanitizeUser = (user: UserRecord) => ({
    id: user.id,
    name: user.name,
    cpf: user.cpf,
    email: user.email,
    phone: user.phone,
    role: user.role,
});

const normalizeCpf = (cpf: string): string => cpf.replace(/\D/g, '');

const generateTokens = async (user: UserRecord): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = signJwt(
        { sub: user.id, role: user.role, type: 'access' },
        env.jwtAccessTtlSeconds,
        env.jwtSecret,
    );

    const refreshToken = signJwt(
        { sub: user.id, role: user.role, type: 'refresh' },
        env.jwtRefreshTtlSeconds,
        env.jwtSecret,
    );

    const expiresAt = new Date(Date.now() + env.jwtRefreshTtlSeconds * 1000);
    await refreshTokensRepository.create(user.id, refreshToken, expiresAt);

    return { accessToken, refreshToken };
};

export const authService = {
    async register(input: {
        name: string;
        cpf: string;
        email: string;
        phone?: string;
        password: string;
    }): Promise<AuthResponse> {
        const cpf = normalizeCpf(input.cpf);
        const email = input.email.trim().toLowerCase();

        if (!input.name.trim() || !cpf || !email || !input.password) {
            throw new AppError('Dados obrigatorios ausentes.', 400);
        }

        const existingByEmail = await usersRepository.findByEmail(email);
        if (existingByEmail) {
            throw new AppError('E-mail ja cadastrado.', 409);
        }

        const existingByCpf = await usersRepository.findByCpf(cpf);
        if (existingByCpf) {
            throw new AppError('CPF ja cadastrado.', 409);
        }

        const user = await usersRepository.create({
            name: input.name.trim(),
            cpf,
            email,
            phone: input.phone?.trim() || null,
            passwordHash: hashPassword(input.password),
            role: 'USER',
        });

        const tokens = await generateTokens(user);

        await auditLogsRepository.add({
            actorUserId: user.id,
            action: 'AUTH_REGISTER',
            entity: 'users',
            entityId: user.id,
        });

        return {
            ...tokens,
            user: sanitizeUser(user),
        };
    },

    async login(input: { identity: string; password: string }): Promise<AuthResponse> {
        const identity = input.identity.trim();
        if (!identity || !input.password) {
            throw new AppError('Credenciais invalidas.', 400);
        }

        const isEmail = identity.includes('@');
        const user = isEmail
            ? await usersRepository.findByEmail(identity.toLowerCase())
            : await usersRepository.findByCpf(normalizeCpf(identity));

        if (!user || !verifyPassword(input.password, user.password_hash)) {
            throw new AppError('Credenciais invalidas.', 401);
        }

        const tokens = await generateTokens(user);

        await auditLogsRepository.add({
            actorUserId: user.id,
            action: 'AUTH_LOGIN',
            entity: 'users',
            entityId: user.id,
        });

        return {
            ...tokens,
            user: sanitizeUser(user),
        };
    },

    async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        if (!refreshToken?.trim()) {
            throw new AppError('Refresh token obrigatorio.', 400);
        }

        const found = await refreshTokensRepository.findActive(refreshToken.trim());
        if (!found) {
            throw new AppError('Refresh token invalido.', 401);
        }

        const user = await usersRepository.findById(found.user_id);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        await refreshTokensRepository.revokeById(found.id);

        return generateTokens(user);
    },

    async me(userId: string) {
        const user = await usersRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        return sanitizeUser(user);
    },
};
