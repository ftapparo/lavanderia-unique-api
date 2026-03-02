import { machinesRepository } from '../db/repositories/machines.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import type { MachineView } from '../types/domain.types';
import type { MachineType } from '../types/domain.types';
import { AppError } from '../utils/app-error';

export const machinesService = {
    async create(input: {
        unitId: string;
        name: string;
        type: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        const unitId = input.unitId.trim();
        const name = input.name.trim();
        const type = input.type;

        if (!unitId || !name || !type) {
            throw new AppError('Dados obrigatorios ausentes para criar maquina.', 400);
        }

        if (type !== 'WASHER' && type !== 'DRYER') {
            throw new AppError('Tipo de maquina invalido.', 400);
        }

        const unit = await unitsRepository.findById(unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const machine = await machinesRepository.create({
            unitId,
            name,
            type,
            tuyaDeviceId: input.tuyaDeviceId ?? null,
            active: input.active ?? true,
        });

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_CREATED',
            entity: 'machines',
            entityId: machine.id,
            payload: {
                unitId: machine.unit_id,
                name: machine.name,
                type: machine.type,
                active: machine.active,
            },
        });

        const machineView = await machinesRepository.findViewById(machine.id);
        if (!machineView) {
            throw new AppError('Falha ao carregar maquina criada.', 500);
        }

        return machineView;
    },

    async list(userId: string, isAdmin: boolean): Promise<MachineView[]> {
        if (isAdmin) {
            return machinesRepository.listAll();
        }

        return machinesRepository.listByUserId(userId);
    },
};
