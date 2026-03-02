import { machinesRepository } from '../db/repositories/machines.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import type { MachineView } from '../types/domain.types';
import type { MachineType } from '../types/domain.types';
import { AppError } from '../utils/app-error';

const composeMachineName = (number: number, brand: string, model: string): string =>
    `#${number} ${brand} ${model}`;

export const machinesService = {
    async create(input: {
        number: number;
        brand: string;
        model: string;
        type: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        const number = Number(input.number);
        const brand = input.brand.trim();
        const model = input.model.trim();
        const type = input.type;

        if (!Number.isInteger(number) || number <= 0 || !brand || !model || !type) {
            throw new AppError('Dados obrigatorios ausentes para criar maquina.', 400);
        }

        if (type !== 'WASHER' && type !== 'DRYER') {
            throw new AppError('Tipo de maquina invalido.', 400);
        }

        let machine;
        try {
            machine = await machinesRepository.create({
                number,
                brand,
                model,
                name: composeMachineName(number, brand, model),
                type,
                tuyaDeviceId: input.tuyaDeviceId ?? null,
                active: input.active ?? true,
            });
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                throw new AppError('Numero de maquina ja cadastrado.', 409);
            }
            throw error;
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_CREATED',
            entity: 'machines',
            entityId: machine.id,
            payload: {
                number: machine.number,
                brand: machine.brand,
                model: machine.model,
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

    async update(id: string, input: {
        number?: number;
        brand?: string;
        model?: string;
        type?: MachineType;
        tuyaDeviceId?: string | null;
        active?: boolean;
    }, actorUserId: string): Promise<MachineView> {
        const existing = await machinesRepository.findById(id);
        if (!existing) {
            throw new AppError('Maquina nao encontrada.', 404);
        }

        const nextNumber = typeof input.number === 'number' ? Number(input.number) : existing.number;
        const nextBrand = input.brand?.trim() || existing.brand;
        const nextModel = input.model?.trim() || existing.model;
        const nextType = (input.type || existing.type) as MachineType;

        if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
            throw new AppError('Numero de maquina invalido.', 400);
        }

        if (!nextBrand || !nextModel) {
            throw new AppError('Marca e modelo da maquina sao obrigatorios.', 400);
        }

        if (nextType !== 'WASHER' && nextType !== 'DRYER') {
            throw new AppError('Tipo de maquina invalido.', 400);
        }

        let updated;
        try {
            updated = await machinesRepository.update(id, {
                number: nextNumber,
                brand: nextBrand,
                model: nextModel,
                name: composeMachineName(nextNumber, nextBrand, nextModel),
                type: nextType,
                tuyaDeviceId: input.tuyaDeviceId === undefined ? existing.tuya_device_id : input.tuyaDeviceId,
                active: input.active ?? existing.active,
            });
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                throw new AppError('Numero de maquina ja cadastrado.', 409);
            }
            throw error;
        }

        if (!updated) {
            throw new AppError('Falha ao atualizar maquina.', 500);
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_UPDATED',
            entity: 'machines',
            entityId: id,
            payload: input as Record<string, unknown>,
        });

        const machineView = await machinesRepository.findViewById(id);
        if (!machineView) {
            throw new AppError('Falha ao carregar maquina atualizada.', 500);
        }

        return machineView;
    },

    async remove(id: string, actorUserId: string): Promise<void> {
        const existing = await machinesRepository.findById(id);
        if (!existing) {
            throw new AppError('Maquina nao encontrada.', 404);
        }

        try {
            const removed = await machinesRepository.deleteById(id);
            if (!removed) {
                throw new AppError('Falha ao remover maquina.', 500);
            }
        } catch (error) {
            if ((error as { code?: string }).code === '23503') {
                throw new AppError('Maquina possui relacionamentos e nao pode ser removida.', 409);
            }
            throw error;
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_DELETED',
            entity: 'machines',
            entityId: id,
            payload: {},
        });
    },
};
