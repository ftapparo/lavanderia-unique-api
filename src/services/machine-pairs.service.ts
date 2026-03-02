import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { machinesRepository } from '../db/repositories/machines.repository';
import type { MachinePairView } from '../types/domain.types';
import { AppError } from '../utils/app-error';

const normalizeName = (value: string): string => value.trim();

export const machinePairsService = {
    async create(input: {
        name: string;
        washerMachineId: string;
        dryerMachineId: string;
        active?: boolean;
    }, actorUserId: string) {
        const name = normalizeName(input.name);
        const washerMachineId = input.washerMachineId.trim();
        const dryerMachineId = input.dryerMachineId.trim();

        if (!name || !washerMachineId || !dryerMachineId) {
            throw new AppError('Dados obrigatorios ausentes para criar par de maquinas.', 400);
        }

        if (washerMachineId === dryerMachineId) {
            throw new AppError('Lavadora e secadora devem ser maquinas diferentes.', 400);
        }

        const washer = await machinesRepository.findById(washerMachineId);
        if (!washer || washer.type !== 'WASHER') {
            throw new AppError('Lavadora informada nao encontrada.', 404);
        }

        const dryer = await machinesRepository.findById(dryerMachineId);
        if (!dryer || dryer.type !== 'DRYER') {
            throw new AppError('Secadora informada nao encontrada.', 404);
        }

        let pair;
        try {
            pair = await machinePairsRepository.create({
                name,
                washerMachineId,
                dryerMachineId,
                active: input.active ?? true,
            });
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                throw new AppError('Par de maquinas ja cadastrado com esse nome ou equipamento.', 409);
            }
            throw error;
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_PAIR_CREATED',
            entity: 'machine_pairs',
            entityId: pair.id,
            payload: {
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
