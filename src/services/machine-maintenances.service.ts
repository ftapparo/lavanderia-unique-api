import { machineMaintenancesRepository } from '../db/repositories/machine-maintenances.repository';
import { machinesRepository } from '../db/repositories/machines.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import type { MachineMaintenanceView } from '../types/domain.types';
import { AppError } from '../utils/app-error';

export const machineMaintenancesService = {
    /**
     * Abre uma manutenção para uma máquina.
     * - Muda o status da máquina para MAINTENANCE
     * - Muda o status da máquina par (WASHER↔DRYER) para MAINTENANCE também
     * - Desativa o par de máquinas para reservas
     */
    async open(input: {
        machineId: string;
        problem: string;
        startedAt?: string;
    }, actorUserId: string): Promise<MachineMaintenanceView> {
        const machine = await machinesRepository.findById(input.machineId);
        if (!machine) {
            throw new AppError('Maquina nao encontrada.', 404);
        }

        const problem = input.problem?.trim();
        if (!problem) {
            throw new AppError('Descricao do problema e obrigatoria.', 400);
        }

        // Abre registro de manutenção
        const maintenance = await machineMaintenancesRepository.create({
            machineId: machine.id,
            problem,
            startedAt: input.startedAt,
            createdByUserId: actorUserId,
        });

        // Coloca a máquina em manutenção
        await machinesRepository.setStatus(machine.id, 'MAINTENANCE');

        // Busca o par e coloca a outra máquina em manutenção também
        const pair = await machinePairsRepository.findByMachineId(machine.id);
        if (pair) {
            const partnerMachineId = pair.washer_machine_id === machine.id
                ? pair.dryer_machine_id
                : pair.washer_machine_id;

            await machinesRepository.setStatus(partnerMachineId, 'MAINTENANCE');
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_MAINTENANCE_OPENED',
            entity: 'machine_maintenances',
            entityId: maintenance.id,
            payload: { machineId: machine.id, problem },
        });

        const view = await this._getView(maintenance.id);
        if (!view) throw new AppError('Falha ao carregar manutencao criada.', 500);
        return view;
    },

    /**
     * Fecha uma manutenção aberta.
     * - Muda status da máquina principal para ACTIVE
     * - Muda status da máquina par para ACTIVE (somente se não tiver outra manutenção aberta)
     */
    async close(id: string, input: {
        solution?: string | null;
        endedAt?: string;
    }, actorUserId: string): Promise<MachineMaintenanceView> {
        const existing = await machineMaintenancesRepository.findById(id);
        if (!existing) {
            throw new AppError('Manutencao nao encontrada.', 404);
        }
        if (existing.ended_at !== null) {
            throw new AppError('Manutencao ja encerrada.', 409);
        }

        const closed = await machineMaintenancesRepository.close(id, {
            solution: input.solution ?? null,
            endedAt: input.endedAt,
            closedByUserId: actorUserId,
        });

        if (!closed) {
            throw new AppError('Falha ao encerrar manutencao.', 500);
        }

        // Reativa a máquina principal (se não tiver outra manutenção aberta)
        const otherOpen = await machineMaintenancesRepository.findOpenByMachineId(existing.machine_id);
        if (!otherOpen) {
            await machinesRepository.setStatus(existing.machine_id, 'ACTIVE');
        }

        // Reativa a máquina par se ela não tiver outra manutenção aberta
        const pair = await machinePairsRepository.findByMachineId(existing.machine_id);
        if (pair) {
            const partnerMachineId = pair.washer_machine_id === existing.machine_id
                ? pair.dryer_machine_id
                : pair.washer_machine_id;

            const partnerOpen = await machineMaintenancesRepository.findOpenByMachineId(partnerMachineId);
            if (!partnerOpen) {
                await machinesRepository.setStatus(partnerMachineId, 'ACTIVE');
            }
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_MAINTENANCE_CLOSED',
            entity: 'machine_maintenances',
            entityId: id,
            payload: { solution: input.solution ?? null },
        });

        const view = await this._getView(id);
        if (!view) throw new AppError('Falha ao carregar manutencao encerrada.', 500);
        return view;
    },

    /**
     * Cancela (soft delete) uma manutenção ainda aberta.
     * - Reverte o status das máquinas para ACTIVE (se não houver outra manutenção aberta)
     */
    async cancel(id: string, actorUserId: string): Promise<void> {
        const existing = await machineMaintenancesRepository.findById(id);
        if (!existing) {
            throw new AppError('Manutencao nao encontrada.', 404);
        }
        if (existing.ended_at !== null) {
            throw new AppError('Manutencao ja encerrada, nao pode ser cancelada.', 409);
        }
        if (existing.deleted_at !== null) {
            throw new AppError('Manutencao ja cancelada.', 409);
        }

        const cancelled = await machineMaintenancesRepository.cancel(id, actorUserId);
        if (!cancelled) {
            throw new AppError('Falha ao cancelar manutencao.', 500);
        }

        // Reativa a máquina principal se não houver outra manutenção aberta
        const otherOpen = await machineMaintenancesRepository.findOpenByMachineId(existing.machine_id);
        if (!otherOpen) {
            await machinesRepository.setStatus(existing.machine_id, 'ACTIVE');
        }

        // Reativa a máquina par se não houver outra manutenção aberta
        const pair = await machinePairsRepository.findByMachineId(existing.machine_id);
        if (pair) {
            const partnerMachineId = pair.washer_machine_id === existing.machine_id
                ? pair.dryer_machine_id
                : pair.washer_machine_id;

            const partnerOpen = await machineMaintenancesRepository.findOpenByMachineId(partnerMachineId);
            if (!partnerOpen) {
                await machinesRepository.setStatus(partnerMachineId, 'ACTIVE');
            }
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'MACHINE_MAINTENANCE_CANCELLED',
            entity: 'machine_maintenances',
            entityId: id,
            payload: { machineId: existing.machine_id },
        });
    },

    async listByMachine(machineId: string): Promise<MachineMaintenanceView[]> {
        const machine = await machinesRepository.findById(machineId);
        if (!machine) {
            throw new AppError('Maquina nao encontrada.', 404);
        }

        return machineMaintenancesRepository.listByMachineId(machineId);
    },

    async listAll(): Promise<MachineMaintenanceView[]> {
        return machineMaintenancesRepository.listAll();
    },

    async listAllPaginated(input: { cursor?: string; limit: number }): Promise<MachineMaintenanceView[]> {
        return machineMaintenancesRepository.listAllPaginated(input);
    },

    async _getView(id: string): Promise<MachineMaintenanceView | null> {
        const all = await machineMaintenancesRepository.listAll();
        return all.find(m => m.id === id) ?? null;
    },
};
