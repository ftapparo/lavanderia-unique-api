import { env } from '../config/env';
import type { UserRecord } from '../types/domain.types';
import { AppError } from '../utils/app-error';
import { signJwt } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { usersRepository } from '../db/repositories/users.repository';
import { refreshTokensRepository } from '../db/repositories/refresh-tokens.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { notificationEmailService } from './notification-email.service';

export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    mustChangePassword: boolean;
    user: {
        id: string;
        name: string;
        cpf: string;
        email: string;
        phone: string | null;
        role: string;
        cargo: string | null;
        hasPin: boolean;
        hasProfilePhoto: boolean;
        profilePhotoBase64: string | null;
        profilePhotoMime: string | null;
    };
};

const sanitizeUser = (user: UserRecord) => ({
    id: user.id,
    name: user.name,
    cpf: user.cpf,
    email: user.email,
    phone: user.phone,
    role: user.role,
    cargo: user.cargo,
    hasPin: Boolean(user.pin_hash),
    hasProfilePhoto: Boolean(user.profile_photo),
    profilePhotoBase64: user.profile_photo ? user.profile_photo.toString('base64') : null,
    profilePhotoMime: user.profile_photo_mime ?? null,
});

const normalizeDocument = (value: string): string => value.replace(/\D/g, '');
const isValidDocument = (document: string): boolean => document.length === 11 || document.length === 14;
const generatePin = (): string => String(Math.floor(100000 + Math.random() * 900000));
const ALLOWED_PROFILE_PHOTO_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
const MAX_PROFILE_PHOTO_BYTES = 256 * 1024;

const decodeBase64Image = (value: string): Buffer => {
    const trimmed = value.trim();
    const payload = trimmed.includes(',') ? trimmed.slice(trimmed.indexOf(',') + 1) : trimmed;
    if (!payload) {
        throw new AppError('Imagem de perfil invalida.', 400);
    }
    const normalizedPayload = payload.replace(/\s+/g, '');
    const buffer = Buffer.from(normalizedPayload, 'base64');
    if (!buffer.length || buffer.toString('base64') !== normalizedPayload) {
        throw new AppError('Imagem de perfil em base64 invalida.', 400);
    }
    return buffer;
};

const normalizeProfilePhotoInput = (input?: {
    profilePhotoBase64?: string | null;
    profilePhotoMime?: string | null;
}): {
    profilePhotoBuffer?: Buffer | null;
    profilePhotoMime?: string | null;
} => {
    if (!input || input.profilePhotoBase64 === undefined) return {};

    if (input.profilePhotoBase64 === null || String(input.profilePhotoBase64).trim() === '') {
        return { profilePhotoBuffer: null, profilePhotoMime: null };
    }

    const mime = String(input.profilePhotoMime || '').trim().toLowerCase();
    if (!mime || !ALLOWED_PROFILE_PHOTO_MIME.includes(mime as typeof ALLOWED_PROFILE_PHOTO_MIME[number])) {
        throw new AppError('Tipo de imagem de perfil invalido. Use JPEG, PNG ou WEBP.', 400);
    }

    const buffer = decodeBase64Image(String(input.profilePhotoBase64));
    if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
        throw new AppError(`Imagem de perfil muito grande. Limite de ${MAX_PROFILE_PHOTO_BYTES} bytes.`, 400);
    }

    return {
        profilePhotoBuffer: buffer,
        profilePhotoMime: mime,
    };
};

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
        const document = normalizeDocument(input.cpf);
        const email = input.email.trim().toLowerCase();

        if (!input.name.trim() || !document || !email || !input.password) {
            throw new AppError('Dados obrigatorios ausentes.', 400);
        }
        if (!isValidDocument(document)) {
            throw new AppError('Documento invalido. Informe CPF (11 digitos) ou CNPJ (14 digitos).', 400);
        }

        const existingByEmail = await usersRepository.findByEmail(email);
        if (existingByEmail) {
            throw new AppError('E-mail ja cadastrado.', 409);
        }

        const existingByCpf = await usersRepository.findByCpf(document);
        if (existingByCpf) {
            throw new AppError('CPF/CNPJ ja cadastrado.', 409);
        }

        const user = await usersRepository.create({
            name: input.name.trim(),
            cpf: document,
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
            mustChangePassword: user.must_change_password,
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
            : await usersRepository.findByCpf(normalizeDocument(identity));

        if (!user) {
            throw new AppError('Credenciais invalidas.', 401);
        }

        // Tenta autenticar via senha (se existir)
        const authenticatedByPassword =
            user.password_hash != null && verifyPassword(input.password, user.password_hash);

        // Se senha falhou ou nÃ£o existe, tenta via PIN
        const authenticatedByPin =
            !authenticatedByPassword &&
            user.pin_hash != null &&
            verifyPassword(input.password, user.pin_hash);

        if (!authenticatedByPassword && !authenticatedByPin) {
            throw new AppError('Credenciais invalidas.', 401);
        }

        // Efeitos colaterais conforme o tipo de credencial usada
        if (authenticatedByPassword && user.pin_hash != null) {
            // UsuÃ¡rio lembrou da senha enquanto havia PIN pendente: descarta o PIN
            await usersRepository.clearPin(user.id);
            user.pin_hash = null;
        } else if (authenticatedByPin) {
            // Acesso via PIN temporÃ¡rio: obriga troca de senha
            await usersRepository.setMustChangePassword(user.id, true);
            user.must_change_password = true;
        }

        const tokens = await generateTokens(user);

        await auditLogsRepository.add({
            actorUserId: user.id,
            action: 'AUTH_LOGIN',
            entity: 'users',
            entityId: user.id,
            payload: { via: authenticatedByPin ? 'pin' : 'password' },
        });

        return {
            ...tokens,
            mustChangePassword: user.must_change_password,
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

    async forgotPassword(input: { identity: string; cpf: string }): Promise<{ requested: boolean }> {
        const identity = String(input.identity || '').trim();
        const cpf = normalizeDocument(String(input.cpf || '').trim());

        if (!identity) {
            throw new AppError('E-mail obrigatorio.', 400);
        }
        if (!cpf || (cpf.length !== 11 && cpf.length !== 14)) {
            throw new AppError('CPF ou CNPJ obrigatorio.', 400);
        }

        const user = await usersRepository.findByEmail(identity.toLowerCase());

        // Valida que email e CPF pertencem ao mesmo usuario.
        // Erro explícito: o APP precisa informar o usuario que os dados nao conferem.
        if (!user || user.cpf !== cpf) {
            throw new AppError('E-mail e CPF nao correspondem a uma conta cadastrada.', 422);
        }

        const generatedPin = generatePin();
        await usersRepository.setPin(user.id, hashPassword(generatedPin));

        await auditLogsRepository.add({
            actorUserId: user.id,
            action: 'AUTH_FORGOT_PASSWORD',
            entity: 'users',
            entityId: user.id,
        });

        try {
            await notificationEmailService.sendPasswordResetEmail(
                { name: user.name, email: user.email },
                generatedPin,
            );
        } catch (err) {
            console.warn('[auth.service] Falha ao enviar email de reset para', user.email, err);
        }

        return { requested: true };
    },

    async verifyPin(input: { identity: string; pin: string }): Promise<{ valid: boolean }> {
        const identity = String(input.identity || '').trim();
        const pin = String(input.pin || '').trim();

        if (!identity) {
            throw new AppError('Identificacao obrigatoria.', 400);
        }
        if (!/^\d{6}$/.test(pin)) {
            throw new AppError('PIN invalido. Informe 6 digitos numericos.', 400);
        }

        const user = identity.includes('@')
            ? await usersRepository.findByEmail(identity.toLowerCase())
            : await usersRepository.findByCpf(normalizeDocument(identity));

        if (!user || !user.pin_hash || !verifyPassword(pin, user.pin_hash)) {
            throw new AppError('CPF ou PIN invalido.', 401);
        }

        return { valid: true };
    },

    async resetPasswordByPin(input: { identity: string; pin: string; newPassword: string }): Promise<{ changed: boolean }> {
        const identity = String(input.identity || '').trim();
        const pin = String(input.pin || '').trim();
        const newPassword = String(input.newPassword || '').trim();

        if (!identity) {
            throw new AppError('Identificacao obrigatoria.', 400);
        }
        if (!/^\d{6}$/.test(pin)) {
            throw new AppError('PIN invalido. Informe 6 digitos numericos.', 400);
        }
        if (!newPassword) {
            throw new AppError('Nova senha obrigatoria.', 400);
        }
        if (newPassword.length < 8) {
            throw new AppError('A nova senha deve ter pelo menos 8 caracteres.', 400);
        }
        if (!/[A-Z]/.test(newPassword)) {
            throw new AppError('A nova senha deve conter pelo menos uma letra maiuscula.', 400);
        }
        if (!/[a-z]/.test(newPassword)) {
            throw new AppError('A nova senha deve conter pelo menos uma letra minuscula.', 400);
        }
        if (!/\d/.test(newPassword)) {
            throw new AppError('A nova senha deve conter pelo menos um numero.', 400);
        }
        if (!/[^A-Za-z0-9]/.test(newPassword)) {
            throw new AppError('A nova senha deve conter pelo menos um caractere especial.', 400);
        }

        const user = identity.includes('@')
            ? await usersRepository.findByEmail(identity.toLowerCase())
            : await usersRepository.findByCpf(normalizeDocument(identity));

        if (!user || !user.pin_hash || !verifyPassword(pin, user.pin_hash)) {
            throw new AppError('PIN invalido ou expirado.', 401);
        }

        await usersRepository.setPasswordHash(user.id, hashPassword(newPassword), false);

        await auditLogsRepository.add({
            actorUserId: user.id,
            action: 'AUTH_RESET_PASSWORD_BY_PIN',
            entity: 'users',
            entityId: user.id,
        });

        return { changed: true };
    },

    async me(userId: string) {
        const user = await usersRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        return { ...sanitizeUser(user), mustChangePassword: user.must_change_password };
    },

    async updateMe(
        userId: string,
        input: {
            email?: string;
            phone?: string | null;
            profilePhotoBase64?: string | null;
            profilePhotoMime?: string | null;
        },
    ) {
        const existing = await usersRepository.findById(userId);
        if (!existing) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        const patch: {
            email?: string;
            phone?: string | null;
            profilePhotoBuffer?: Buffer | null;
            profilePhotoMime?: string | null;
        } = {};

        if (input.email !== undefined) {
            const email = String(input.email).trim().toLowerCase();
            if (!email) {
                throw new AppError('E-mail invalido.', 400);
            }
            const byEmail = await usersRepository.findByEmail(email);
            if (byEmail && byEmail.id !== userId) {
                throw new AppError('E-mail ja cadastrado.', 409);
            }
            patch.email = email;
        }

        if (input.phone !== undefined) {
            patch.phone = input.phone ? String(input.phone).trim() : null;
        }

        const normalizedPhoto = normalizeProfilePhotoInput({
            profilePhotoBase64: input.profilePhotoBase64,
            profilePhotoMime: input.profilePhotoMime,
        });
        if (normalizedPhoto.profilePhotoBuffer !== undefined) {
            patch.profilePhotoBuffer = normalizedPhoto.profilePhotoBuffer;
            patch.profilePhotoMime = normalizedPhoto.profilePhotoMime ?? null;
        }

        const updated = await usersRepository.update(userId, patch);
        if (!updated) {
            throw new AppError('Erro ao atualizar perfil.', 500);
        }

        await auditLogsRepository.add({
            actorUserId: userId,
            action: 'AUTH_UPDATE_PROFILE',
            entity: 'users',
            entityId: userId,
            payload: {
                email: patch.email,
                phone: patch.phone,
                profilePhotoUpdated: patch.profilePhotoBuffer !== undefined,
            },
        });

        return { ...sanitizeUser(updated), mustChangePassword: updated.must_change_password };
    },

    async changePassword(userId: string, input: { currentPassword?: string; newPassword: string }): Promise<void> {
        if (!input.newPassword?.trim()) {
            throw new AppError('Nova senha obrigatoria.', 400);
        }

        if (input.newPassword.trim().length < 6) {
            throw new AppError('A nova senha deve ter pelo menos 6 caracteres.', 400);
        }

        const user = await usersRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        if (user.pin_hash != null) {
            if (!input.currentPassword?.trim()) {
                throw new AppError('PIN obrigatorio.', 400);
            }
            const pin = input.currentPassword.trim();
            if (!/^\d{6}$/.test(pin)) {
                throw new AppError('PIN invalido. Informe 6 digitos numericos.', 400);
            }
            if (!verifyPassword(pin, user.pin_hash)) {
                throw new AppError('PIN incorreto.', 401);
            }
        } else if (user.password_hash != null) {
            if (!input.currentPassword?.trim()) {
                throw new AppError('Senha atual obrigatoria.', 400);
            }
            if (!verifyPassword(input.currentPassword.trim(), user.password_hash)) {
                throw new AppError('Senha atual incorreta.', 401);
            }
        } else {
            throw new AppError('Usuario sem credencial ativa para troca de senha.', 409);
        }

        // setPasswordHash limpa pin_hash e must_change_password automaticamente
        await usersRepository.setPasswordHash(userId, hashPassword(input.newPassword.trim()), false);

        await auditLogsRepository.add({
            actorUserId: userId,
            action: 'AUTH_CHANGE_PASSWORD',
            entity: 'users',
            entityId: userId,
        });
    },
};
