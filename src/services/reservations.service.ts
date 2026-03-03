import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { membershipsRepository } from '../db/repositories/memberships.repository';
import { reservationsRepository } from '../db/repositories/reservations.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import { usersRepository } from '../db/repositories/users.repository';
import type { ReservationBusyView, ReservationRecord, ReservationView } from '../types/domain.types';
import { AppError } from '../utils/app-error';

type PgErrorLike = {
    code?: string;
    detail?: string;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const toDate = (value: string): Date => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Data/hora invalida para reserva.', 400);
    }
    return parsed;
};

const toIso = (date: Date): string => date.toISOString();

const getActiveMembershipOnDate = async (userId: string, unitId: string, atDate: Date) => {
    return membershipsRepository.findActiveByUserAndUnitOnDate(
        userId,
        unitId,
        atDate.toISOString().slice(0, 10),
    );
};

const mapReservationDbError = (error: unknown): never => {
    const pgError = error as PgErrorLike;

    if (pgError?.code === '23P01') {
        throw new AppError('Conflito de horario para o par de maquinas informado.', 409);
    }

    if (pgError?.code === '23514') {
        throw new AppError('Reserva invalida. A duracao deve ser exatamente de 2 horas.', 400, pgError.detail);
    }

    throw error;
};

export const reservationsService = {
    async create(input: {
        unitId: string;
        machinePairId: string;
        startAt: string;
        userId?: string;
    }, userId: string, isAdmin: boolean): Promise<ReservationRecord> {
        const unitId = input.unitId.trim();
        const machinePairId = input.machinePairId.trim();
        if (!unitId || !machinePairId) {
            throw new AppError('Unidade e par de maquinas sao obrigatorios.', 400);
        }
        const startAt = toDate(input.startAt);
        const endAt = new Date(startAt.getTime() + TWO_HOURS_MS);
        const reservationDateIso = startAt.toISOString().slice(0, 10);
        const requestedUserId = input.userId?.trim() || '';

        const unit = await unitsRepository.findById(unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const actorCanManageUnit = isAdmin || await membershipsRepository.hasAnyProfileByUserAndUnitOnDate({
            userId,
            unitId,
            dateIso: reservationDateIso,
            profiles: ['ADMINISTRADOR', 'SUPER'],
        });

        let targetReservationUserId = userId;
        if (requestedUserId) {
            if (!isAdmin && !actorCanManageUnit) {
                throw new AppError('Sem permissao para reservar em nome de outro usuario.', 403);
            }
            targetReservationUserId = requestedUserId;
        }

        const pair = await machinePairsRepository.findById(machinePairId);
        if (!pair) {
            throw new AppError('Par de maquinas nao encontrado.', 404);
        }

        if (!pair.active) {
            throw new AppError('Par de maquinas inativo.', 400);
        }

        if ((isAdmin || actorCanManageUnit) && targetReservationUserId !== userId) {
            const targetUser = await usersRepository.findById(targetReservationUserId);
            if (!targetUser) {
                throw new AppError('Usuario selecionado para reserva nao encontrado.', 404);
            }
        }

        const activeMembership = await getActiveMembershipOnDate(targetReservationUserId, unitId, startAt);
        if (!activeMembership) {
            throw new AppError('Usuario sem vinculo ativo para a unidade da reserva.', 403);
        }

        if (!isAdmin && !actorCanManageUnit && activeMembership.profile === 'HOSPEDE' && !unit.allow_guest_reservations) {
            throw new AppError('Reservas de hospede desativadas para esta unidade.', 403);
        }

        try {
            const reservation = await reservationsRepository.create({
                unitId,
                machinePairId: pair.id,
                userId: targetReservationUserId,
                startAt: toIso(startAt),
                endAt: toIso(endAt),
                status: 'CONFIRMED',
            });

            await auditLogsRepository.add({
                actorUserId: userId,
                action: 'RESERVATION_CREATED',
                entity: 'reservations',
                entityId: reservation.id,
                payload: {
                    reservationUserId: reservation.user_id,
                    unitId: reservation.unit_id,
                    machinePairId: reservation.machine_pair_id,
                    startAt: reservation.start_at,
                    endAt: reservation.end_at,
                    status: reservation.status,
                },
            });

            return reservation;
        } catch (error) {
            return mapReservationDbError(error);
        }
    },

    async list(userId: string, isAdmin: boolean): Promise<ReservationView[]> {
        if (isAdmin) {
            return reservationsRepository.listAll();
        }

        return reservationsRepository.listByUserId(userId);
    },

    async listBusy(): Promise<ReservationBusyView[]> {
        return reservationsRepository.listBusy();
    },

    async cancel(reservationId: string, userId: string, isAdmin: boolean) {
        const reservation = await reservationsRepository.findById(reservationId);
        if (!reservation) {
            throw new AppError('Reserva nao encontrada.', 404);
        }

        if (!isAdmin && reservation.user_id !== userId) {
            throw new AppError('Acesso negado para cancelar esta reserva.', 403);
        }

        if (reservation.status === 'CANCELED') {
            throw new AppError('Reserva ja cancelada.', 409);
        }

        const canceled = await reservationsRepository.cancel(reservationId, userId);
        if (!canceled) {
            throw new AppError('Falha ao cancelar reserva.', 500);
        }

        await auditLogsRepository.add({
            actorUserId: userId,
            action: 'RESERVATION_CANCELED',
            entity: 'reservations',
            entityId: reservationId,
            payload: {
                status: canceled.status,
                canceledAt: canceled.canceled_at,
            },
        });

        return canceled;
    },
};
