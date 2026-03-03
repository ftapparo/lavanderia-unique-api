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

    async create(input: { floor: number; unitNumber: number; active?: boolean; allowGuestReservations?: boolean }, actorUserId: string): Promise<UnitView> {
        const floor = Number(input.floor);
        const unitNumber = Number(input.unitNumber);
        const active = input.active ?? true;
        const allowGuestReservations = input.allowGuestReservations ?? true;

        if (!Number.isInteger(floor) || floor < 0) {
            throw new AppError('Andar invalido. Informe valor inteiro maior ou igual a zero.', 400);
        }

        if (!Number.isInteger(unitNumber) || unitNumber <= 0) {
            throw new AppError('Numero da unidade invalido. Informe valor inteiro maior que zero.', 400);
        }

        const name = floor === 0 ? `${unitNumber}` : `${floor}${unitNumber}`;

        let unit;
        try {
            unit = await unitsRepository.create({
                name,
                floor,
                unitNumber,
                active,
                allowGuestReservations,
            });
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                throw new AppError('Unidade desse andar ja cadastrada.', 409);
            }
            throw error;
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_CREATED',
            entity: 'units',
            entityId: unit.id,
            payload: {
                code: unit.code,
                name: unit.name,
                floor: unit.floor,
                unitNumber: unit.unit_number,
                active: unit.active,
                allowGuestReservations: unit.allow_guest_reservations,
            },
        });

        return {
            id: unit.id,
            code: unit.code,
            name: unit.name,
            floor: unit.floor,
            unitNumber: unit.unit_number,
            active: unit.active,
            allowGuestReservations: unit.allow_guest_reservations,
        };
    },

    async update(id: string, input: { floor?: number; unitNumber?: number; active?: boolean; allowGuestReservations?: boolean }, actorUserId: string): Promise<UnitView> {
        const existing = await unitsRepository.findById(id);
        if (!existing) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const nextFloor = typeof input.floor === 'number' ? Number(input.floor) : undefined;
        const nextUnitNumber = typeof input.unitNumber === 'number' ? Number(input.unitNumber) : undefined;
        const nextActive = typeof input.active === 'boolean' ? input.active : undefined;
        const nextAllowGuestReservations =
            typeof input.allowGuestReservations === 'boolean'
                ? input.allowGuestReservations
                : undefined;

        if (typeof nextFloor === 'number' && (!Number.isInteger(nextFloor) || nextFloor < 0)) {
            throw new AppError('Andar invalido. Informe valor inteiro maior ou igual a zero.', 400);
        }

        if (typeof nextUnitNumber === 'number' && (!Number.isInteger(nextUnitNumber) || nextUnitNumber <= 0)) {
            throw new AppError('Numero da unidade invalido. Informe valor inteiro maior que zero.', 400);
        }

        const resolvedFloor = typeof nextFloor === 'number' ? nextFloor : existing.floor;
        const resolvedUnitNumber = typeof nextUnitNumber === 'number' ? nextUnitNumber : existing.unit_number;
        const resolvedName =
            typeof resolvedFloor === 'number' && typeof resolvedUnitNumber === 'number'
                ? (resolvedFloor === 0 ? `${resolvedUnitNumber}` : `${resolvedFloor}${resolvedUnitNumber}`)
                : existing.name;

        let updated;
        try {
            updated = await unitsRepository.update(id, {
                name: resolvedName,
                floor: nextFloor,
                unitNumber: nextUnitNumber,
                active: nextActive,
                allowGuestReservations: nextAllowGuestReservations,
            });
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                throw new AppError('Unidade desse andar ja cadastrada.', 409);
            }
            throw error;
        }

        if (!updated) {
            throw new AppError('Falha ao atualizar unidade.', 500);
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_UPDATED',
            entity: 'units',
            entityId: id,
            payload: {
                name: updated.name,
                code: updated.code,
                floor: updated.floor,
                unitNumber: updated.unit_number,
                active: updated.active,
                allowGuestReservations: updated.allow_guest_reservations,
            },
        });

        return {
            id: updated.id,
            code: updated.code,
            name: updated.name,
            floor: updated.floor,
            unitNumber: updated.unit_number,
            active: updated.active,
            allowGuestReservations: updated.allow_guest_reservations,
        };
    },

    async remove(id: string, actorUserId: string): Promise<void> {
        const existing = await unitsRepository.findById(id);
        if (!existing) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        try {
            const removed = await unitsRepository.deleteById(id);
            if (!removed) {
                throw new AppError('Falha ao remover unidade.', 500);
            }
        } catch (error) {
            if ((error as { code?: string }).code === '23503') {
                throw new AppError('Unidade possui relacionamentos e nao pode ser removida.', 409);
            }
            throw error;
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_DELETED',
            entity: 'units',
            entityId: id,
            payload: {},
        });
    },
};
