import { membershipsRepository } from '../db/repositories/memberships.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import { usersRepository } from '../db/repositories/users.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { AppError } from '../utils/app-error';

const MEMBERSHIP_PROFILES = ['PROPRIETARIO', 'LOCATARIO', 'HOSPEDE', 'ADMINISTRADOR', 'SUPER'] as const;
type MembershipProfile = typeof MEMBERSHIP_PROFILES[number];

const validateDateRange = (startDate: string, endDate?: string | null): void => {
    if (!startDate) {
        throw new AppError('Data de inicio obrigatoria.', 400);
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
        throw new AppError('Data final deve ser maior ou igual a data inicial.', 400);
    }
};

const normalizeProfile = (inputProfile: string): MembershipProfile => {
    const profile = inputProfile.trim().toUpperCase();
    if (!profile) {
        throw new AppError('Perfil de vinculo obrigatorio.', 400);
    }
    if (!MEMBERSHIP_PROFILES.includes(profile as MembershipProfile)) {
        throw new AppError('Perfil de vinculo invalido.', 400, { allowed: MEMBERSHIP_PROFILES });
    }
    return profile as MembershipProfile;
};

export const membershipsService = {
    async listProfiles() {
        return membershipsRepository.listProfiles();
    },

    async create(input: {
        userId: string;
        unitId: string;
        profile: string;
        startDate: string;
        endDate?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        validateDateRange(input.startDate, input.endDate);

        const user = await usersRepository.findById(input.userId);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        const unit = await unitsRepository.findById(input.unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const profile = normalizeProfile(input.profile);
        const profileExists = await membershipsRepository.profileExists(profile);
        if (!profileExists) {
            throw new AppError('Perfil de vinculo nao cadastrado.', 400);
        }

        if (profile === 'HOSPEDE' && !input.endDate) {
            throw new AppError('Perfil HOSPEDE exige data final.', 400);
        }

        if (profile === 'LOCATARIO') {
            const hasConflict = await membershipsRepository.hasOverlappingLocatarioForUser({
                userId: input.userId,
                unitId: input.unitId,
                startDate: input.startDate,
                endDate: input.endDate,
            });
            if (hasConflict) {
                throw new AppError('Locatario pode ocupar apenas uma unidade por periodo.', 409);
            }
        }

        const membership = await membershipsRepository.create({
            userId: input.userId,
            unitId: input.unitId,
            profile,
            startDate: input.startDate,
            endDate: input.endDate,
            active: input.active ?? true,
        });

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_MEMBERSHIP_CREATED',
            entity: 'unit_memberships',
            entityId: membership.id,
            payload: {
                userId: membership.user_id,
                unitId: membership.unit_id,
                profile: membership.profile,
                startDate: membership.start_date,
                endDate: membership.end_date,
            },
        });

        return membership;
    },

    async update(id: string, input: {
        profile?: string;
        startDate?: string;
        endDate?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        const existing = await membershipsRepository.findById(id);
        if (!existing) {
            throw new AppError('Vinculo nao encontrado.', 404);
        }

        const nextStartDate = input.startDate ?? existing.start_date;
        const nextEndDate = input.endDate ?? existing.end_date;
        const nextProfile = input.profile ? normalizeProfile(input.profile) : (existing.profile as MembershipProfile);
        validateDateRange(nextStartDate, nextEndDate);

        if (nextProfile === 'HOSPEDE' && !nextEndDate) {
            throw new AppError('Perfil HOSPEDE exige data final.', 400);
        }

        if (nextProfile === 'LOCATARIO') {
            const hasConflict = await membershipsRepository.hasOverlappingLocatarioForUser({
                userId: existing.user_id,
                unitId: existing.unit_id,
                startDate: nextStartDate,
                endDate: nextEndDate,
                excludeMembershipId: existing.id,
            });
            if (hasConflict) {
                throw new AppError('Locatario pode ocupar apenas uma unidade por periodo.', 409);
            }
        }

        const updated = await membershipsRepository.update(id, {
            ...input,
            profile: nextProfile,
        });
        if (!updated) {
            throw new AppError('Falha ao atualizar vinculo.', 500);
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_MEMBERSHIP_UPDATED',
            entity: 'unit_memberships',
            entityId: id,
            payload: input as Record<string, unknown>,
        });

        return updated;
    },

    async list(userId: string, isAdmin: boolean) {
        if (isAdmin) {
            return membershipsRepository.listAll();
        }

        return membershipsRepository.listByUserId(userId);
    },
};
