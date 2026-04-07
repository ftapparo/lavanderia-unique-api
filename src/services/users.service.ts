import { usersRepository } from '../db/repositories/users.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { notificationEmailService } from './notification-email.service';
import { hashPassword } from '../utils/password';
import { AppError } from '../utils/app-error';
import type { UserRole, UserView } from '../types/domain.types';

const MEMBERSHIP_PROFILES = ['PROPRIETARIO', 'LOCATARIO', 'HOSPEDE', 'ADMINISTRADOR', 'SUPER'] as const;
type MembershipProfile = typeof MEMBERSHIP_PROFILES[number];

const normalizeDocument = (value: string): string => value.replace(/\D/g, '');
const isValidDocument = (document: string): boolean => document.length === 11 || document.length === 14;
const ALLOWED_PROFILE_PHOTO_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
const MAX_PROFILE_PHOTO_BYTES = 256 * 1024;

const generatePin = (): string => {
    return String(Math.floor(100000 + Math.random() * 900000));
};

const decodeBase64Image = (value: string): Buffer => {
    const trimmed = value.trim();
    const payload = trimmed.includes(',') ? trimmed.slice(trimmed.indexOf(',') + 1) : trimmed;
    if (!payload) {
        throw new AppError('Imagem de perfil invalida.', 400);
    }
    const buffer = Buffer.from(payload, 'base64');
    if (!buffer.length || buffer.toString('base64') !== payload.replace(/\s+/g, '')) {
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

const sanitizeUser = (record: {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string | null;
    role: UserRole;
    cargo: string | null;
    must_change_password: boolean;
    profile_photo: Buffer | null;
    profile_photo_mime: string | null;
    has_profile_photo?: boolean;
    created_at: string;
}, includeProfilePhotoData = false): UserView => ({
    id: record.id,
    name: record.name,
    cpf: record.cpf,
    email: record.email,
    phone: record.phone,
    role: record.role,
    cargo: record.cargo,
    mustChangePassword: record.must_change_password,
    hasProfilePhoto: typeof record.has_profile_photo === 'boolean'
        ? record.has_profile_photo
        : Boolean(record.profile_photo),
    profilePhotoBase64: includeProfilePhotoData && record.profile_photo
        ? record.profile_photo.toString('base64')
        : null,
    profilePhotoMime: includeProfilePhotoData ? (record.profile_photo_mime ?? null) : null,
    createdAt: record.created_at,
});

export const usersService = {
    async list(filters?: {
        q?: string;
        unitId?: string;
        slotPosition?: number;
        profile?: string;
    }): Promise<UserView[]> {
        const slotPosition = filters?.slotPosition;
        if (slotPosition !== undefined && (!Number.isInteger(slotPosition) || slotPosition < 1 || slotPosition > 3)) {
            throw new AppError('Posicao de vinculo invalida. Informe valor entre 1 e 3.', 400);
        }

        const normalizedProfile = filters?.profile?.trim().toUpperCase() as MembershipProfile | undefined;
        if (normalizedProfile && !MEMBERSHIP_PROFILES.includes(normalizedProfile)) {
            throw new AppError('Perfil de vinculo invalido.', 400, { allowed: MEMBERSHIP_PROFILES });
        }

        if (slotPosition === 1 && normalizedProfile && normalizedProfile !== 'PROPRIETARIO') {
            throw new AppError('A posicao 1 aceita somente perfil PROPRIETARIO.', 400);
        }

        if (slotPosition === 3 && normalizedProfile === 'ADMINISTRADOR') {
            throw new AppError('A posicao 3 nao aceita perfil ADMINISTRADOR.', 400);
        }

        return usersRepository.listAll({
            q: filters?.q,
            unitId: filters?.unitId?.trim() || undefined,
            slotPosition: slotPosition as 1 | 2 | 3 | undefined,
            profile: normalizedProfile,
        });
    },

    async getById(id: string): Promise<UserView> {
        const user = await usersRepository.findById(id);
        if (!user) throw new AppError('Usuario nao encontrado.', 404);
        return sanitizeUser(user, true);
    },

    async create(
        input: {
            name: string;
            cpf: string;
            email: string;
            phone?: string | null;
            role: UserRole;
            cargo?: string | null;
            profilePhotoBase64?: string | null;
            profilePhotoMime?: string | null;
        },
        actorUserId: string,
    ): Promise<{ user: UserView; generatedPin: string }> {
        const document = normalizeDocument(input.cpf);
        const email = input.email.trim().toLowerCase();
        const name = input.name.trim();

        if (!name || !document || !email) {
            throw new AppError('Dados obrigatorios ausentes.', 400);
        }
        if (!isValidDocument(document)) {
            throw new AppError('Documento invalido. Informe CPF (11 digitos) ou CNPJ (14 digitos).', 400);
        }

        const existingByEmail = await usersRepository.findByEmail(email);
        if (existingByEmail) throw new AppError('E-mail ja cadastrado.', 409);

        const existingByCpf = await usersRepository.findByCpf(document);
        if (existingByCpf) throw new AppError('CPF/CNPJ ja cadastrado.', 409);

        const normalizedPhoto = normalizeProfilePhotoInput({
            profilePhotoBase64: input.profilePhotoBase64,
            profilePhotoMime: input.profilePhotoMime,
        });

        // Novo usuário sempre recebe PIN temporário; senha definida no primeiro acesso
        const generatedPin = generatePin();

        const user = await usersRepository.create({
            name,
            cpf: document,
            email,
            phone: input.phone?.trim() || null,
            passwordHash: null,
            pinHash: hashPassword(generatedPin),
            role: input.role,
            cargo: input.role === 'SUPER' ? (input.cargo?.trim() || null) : null,
            mustChangePassword: false,
            profilePhotoBuffer: normalizedPhoto.profilePhotoBuffer,
            profilePhotoMime: normalizedPhoto.profilePhotoMime,
        });

        await auditLogsRepository.add({
            actorUserId,
            action: 'ADMIN_CREATE_USER',
            entity: 'users',
            entityId: user.id,
            payload: { name, email, role: input.role },
        });

        // Envio de email é best-effort: falha não impede criação do usuário
        try {
            await notificationEmailService.sendWelcomeEmail({ name, email }, generatedPin);
        } catch (err) {
            console.warn('[users.service] Falha ao enviar email de boas-vindas para', email, err);
        }

        return { user: sanitizeUser(user, true), generatedPin };
    },

    async update(
        id: string,
        input: {
            name?: string;
            email?: string;
            phone?: string | null;
            role?: UserRole;
            cargo?: string | null;
            profilePhotoBase64?: string | null;
            profilePhotoMime?: string | null;
        },
        actorUserId: string,
    ): Promise<UserView> {
        const existing = await usersRepository.findById(id);
        if (!existing) throw new AppError('Usuario nao encontrado.', 404);

        if (input.email) {
            const email = input.email.trim().toLowerCase();
            const byEmail = await usersRepository.findByEmail(email);
            if (byEmail && byEmail.id !== id) throw new AppError('E-mail ja cadastrado.', 409);
            input.email = email;
        }

        const normalizedPhoto = normalizeProfilePhotoInput({
            profilePhotoBase64: input.profilePhotoBase64,
            profilePhotoMime: input.profilePhotoMime,
        });

        const nextRole = input.role ?? existing.role;
        const updated = await usersRepository.update(id, {
            name: input.name?.trim(),
            email: input.email,
            phone: input.phone !== undefined ? (input.phone?.trim() || null) : undefined,
            role: input.role,
            cargo: nextRole === 'SUPER'
                ? (input.cargo !== undefined ? (input.cargo?.trim() || null) : undefined)
                : null,
            profilePhotoBuffer: normalizedPhoto.profilePhotoBuffer,
            profilePhotoMime: normalizedPhoto.profilePhotoMime,
        });

        if (!updated) throw new AppError('Erro ao atualizar usuario.', 500);

        await auditLogsRepository.add({
            actorUserId,
            action: 'ADMIN_UPDATE_USER',
            entity: 'users',
            entityId: id,
            payload: input as Record<string, unknown>,
        });

        return sanitizeUser(updated, true);
    },

    async resetPassword(
        id: string,
        actorUserId: string,
    ): Promise<{ generatedPin: string }> {
        const existing = await usersRepository.findById(id);
        if (!existing) throw new AppError('Usuario nao encontrado.', 404);

        // Gera novo PIN temporário sem tocar na senha existente do usuário
        const generatedPin = generatePin();
        await usersRepository.setPin(id, hashPassword(generatedPin));

        await auditLogsRepository.add({
            actorUserId,
            action: 'ADMIN_RESET_PASSWORD',
            entity: 'users',
            entityId: id,
        });

        // Envio de email é best-effort: falha não impede o reset
        try {
            await notificationEmailService.sendPasswordResetEmail(
                { name: existing.name, email: existing.email },
                generatedPin,
            );
        } catch (err) {
            console.warn('[users.service] Falha ao enviar email de reset para', existing.email, err);
        }

        return { generatedPin };
    },

    async delete(id: string, actorUserId: string): Promise<void> {
        if (id === actorUserId) {
            throw new AppError('Nao e possivel excluir o proprio usuario.', 400);
        }

        const existing = await usersRepository.findById(id);
        if (!existing) throw new AppError('Usuario nao encontrado.', 404);

        const hasActive = await usersRepository.hasActiveReservations(id);
        if (hasActive) {
            throw new AppError('Usuario possui reservas ativas e nao pode ser excluido.', 409);
        }

        await usersRepository.deleteById(id);

        await auditLogsRepository.add({
            actorUserId,
            action: 'ADMIN_DELETE_USER',
            entity: 'users',
            entityId: id,
            payload: { name: existing.name, email: existing.email },
        });
    },
};
