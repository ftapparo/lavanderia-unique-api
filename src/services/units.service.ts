import { unitsRepository } from '../db/repositories/units.repository';
import type { UnitView } from '../types/domain.types';
import { AppError } from '../utils/app-error';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';

export const unitsService = {
    async list(userId: string, isAdmin: boolean): Promise<UnitView[]> {
        if (isAdmin) {
            return unitsRepository.listAll();
        }

        return unitsRepository.listByUserId(userId);
    },

    async create(input: { name: string; code: string }, actorUserId: string): Promise<UnitView> {
        const name = input.name.trim();
        const code = input.code.trim().toUpperCase();

        if (!name || !code) {
            throw new AppError('Nome e codigo da unidade sao obrigatorios.', 400);
        }

        const unit = await unitsRepository.create(name, code);

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_CREATED',
            entity: 'units',
            entityId: unit.id,
            payload: { name: unit.name, code: unit.code },
        });

        return { id: unit.id, name: unit.name, code: unit.code };
    },
};
