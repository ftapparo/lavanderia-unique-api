import { membershipsRepository } from '../db/repositories/memberships.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import { usersRepository } from '../db/repositories/users.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { AppError } from '../utils/app-error';

const validateDateRange = (startDate: string, endDate?: string | null): void => {
    if (!startDate) {
        throw new AppError('Data de inicio obrigatoria.', 400);
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
        throw new AppError('Data final deve ser maior ou igual a data inicial.', 400);
    }
};

export const membershipsService = {
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

        const profile = input.profile.trim();
        if (!profile) {
            throw new AppError('Perfil de vinculo obrigatorio.', 400);
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

        validateDateRange(input.startDate ?? existing.start_date, input.endDate ?? existing.end_date);

        const updated = await membershipsRepository.update(id, input);
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
