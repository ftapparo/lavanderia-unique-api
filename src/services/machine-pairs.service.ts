import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { machinesRepository } from '../db/repositories/machines.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import type { MachinePairView } from '../types/domain.types';
import { AppError } from '../utils/app-error';

const normalizeName = (value: string): string => value.trim();

export const machinePairsService = {
    async create(input: {
        unitId: string;
        name: string;
        washerMachineId: string;
        dryerMachineId: string;
        active?: boolean;
    }, actorUserId: string) {
        const unitId = input.unitId.trim();
        const name = normalizeName(input.name);
        const washerMachineId = input.washerMachineId.trim();
        const dryerMachineId = input.dryerMachineId.trim();

        if (!unitId || !name || !washerMachineId || !dryerMachineId) {
            throw new AppError('Dados obrigatorios ausentes para criar par de maquinas.', 400);
        }

        if (washerMachineId === dryerMachineId) {
            throw new AppError('Lavadora e secadora devem ser maquinas diferentes.', 400);
        }

        const unit = await unitsRepository.findById(unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const washer = await machinesRepository.findById(washerMachineId);
        if (!washer || washer.type !== 'WASHER') {
            throw new AppError('Lavadora informada nao encontrada.', 404);
        }

        const dryer = await machinesRepository.findById(dryerMachineId);
        if (!dryer || dryer.type !== 'DRYER') {
            throw new AppError('Secadora informada nao encontrada.', 404);
        }

        if (washer.unit_id !== unitId || dryer.unit_id !== unitId) {
            throw new AppError('As maquinas devem pertencer a mesma unidade do par.', 400);
        }

        const pair = await machinePairsRepository.create({
            unitId,
            name,
            washerMachineId,
            dryerMachineId,
            active: input.active ?? true,
        });

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_PAIR_CREATED',
            entity: 'machine_pairs',
            entityId: pair.id,
            payload: {
                unitId: pair.unit_id,
                washerMachineId: pair.washer_machine_id,
                dryerMachineId: pair.dryer_machine_id,
                active: pair.active,
            },
        });

        return pair;
    },

    async list(userId: string, isAdmin: boolean): Promise<MachinePairView[]> {
        if (isAdmin) {
            return machinePairsRepository.listAll();
        }

        return machinePairsRepository.listByUserId(userId);
    },
};
