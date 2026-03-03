import { env } from '../config/env';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import { consumptionSamplesRepository } from '../db/repositories/consumption-samples.repository';
import { laundrySessionsRepository } from '../db/repositories/laundry-sessions.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { machinesRepository } from '../db/repositories/machines.repository';
import { reservationsRepository } from '../db/repositories/reservations.repository';
import { systemSettingsRepository } from '../db/repositories/system-settings.repository';
import { tuyaCommandLogsRepository } from '../db/repositories/tuya-command-logs.repository';
import { tuyaClient } from '../integrations/tuya/tuya-client';
import type { LaundrySessionView, MachineRecord } from '../types/domain.types';
import { AppError } from '../utils/app-error';

const isCheckinWithinWindow = (
    reservationStartAt: string,
    nowDate: Date,
    beforeMinutes: number,
    afterMinutes: number,
): boolean => {
    const start = new Date(reservationStartAt);
    const windowStart = new Date(start.getTime() - (beforeMinutes * 60 * 1000));
    const windowEnd = new Date(start.getTime() + (afterMinutes * 60 * 1000));
    return nowDate >= windowStart && nowDate <= windowEnd;
};

type ControllableMachine = {
    id: string;
    name: string;
    type: 'WASHER' | 'DRYER';
    deviceId: string;
};

const toControllableMachine = (machine: MachineRecord): ControllableMachine | null => {
    if (!machine.active) {
        return null;
    }

    const deviceId = machine.tuya_device_id?.trim();
    if (!deviceId) {
        return null;
    }

    return {
        id: machine.id,
        name: machine.name,
        type: machine.type,
        deviceId,
    };
};

const parseNumeric = (value: number | string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const sessionsService = {
    async checkinReservation(reservationId: string, actorUserId: string, isAdmin: boolean) {
        const reservation = await reservationsRepository.findById(reservationId);
        if (!reservation) {
            throw new AppError('Reserva nao encontrada.', 404);
        }

        if (!isAdmin && reservation.user_id !== actorUserId) {
            throw new AppError('Acesso negado para realizar check-in desta reserva.', 403);
        }

        if (reservation.status === 'CANCELED') {
            throw new AppError('Reserva cancelada. Check-in nao permitido.', 409);
        }

        if (reservation.status === 'IN_PROGRESS') {
            throw new AppError('Reserva ja esta em andamento.', 409);
        }

        if (reservation.status === 'FINISHED') {
            throw new AppError('Reserva ja finalizada.', 409);
        }

        const settings = await systemSettingsRepository.get();
        const checkinBeforeMinutes = settings.checkinWindowBeforeMinutes ?? env.checkinWindowBeforeMinutes;
        const checkinAfterMinutes = settings.checkinWindowAfterMinutes ?? env.checkinWindowAfterMinutes;

        const now = new Date();
        if (!isCheckinWithinWindow(reservation.start_at, now, checkinBeforeMinutes, checkinAfterMinutes)) {
            throw new AppError('Check-in fora da janela permitida.', 409, {
                beforeMinutes: checkinBeforeMinutes,
                afterMinutes: checkinAfterMinutes,
            });
        }

        const pair = await machinePairsRepository.findById(reservation.machine_pair_id);
        if (!pair) {
            throw new AppError('Par de maquinas da reserva nao encontrado.', 404);
        }

        const washer = await machinesRepository.findById(pair.washer_machine_id);
        if (!washer) {
            throw new AppError('Lavadora do par nao encontrada.', 404);
        }

        const dryer = await machinesRepository.findById(pair.dryer_machine_id);
        if (!dryer) {
            throw new AppError('Secadora do par nao encontrada.', 404);
        }

        const controllableMachines = [washer, dryer]
            .map(toControllableMachine)
            .filter((machine): machine is ControllableMachine => Boolean(machine));
        if (controllableMachines.length === 0) {
            throw new AppError('Nenhuma maquina ativa com tuyaDeviceId configurado no par selecionado.', 409);
        }

        const existingSession = await laundrySessionsRepository.findByReservationId(reservation.id);
        if (existingSession) {
            throw new AppError('Check-in ja realizado para esta reserva.', 409);
        }

        const session = await laundrySessionsRepository.create({
            reservationId: reservation.id,
            unitId: reservation.unit_id,
            machinePairId: reservation.machine_pair_id,
            userId: reservation.user_id,
            checkinAt: now.toISOString(),
            startedAt: now.toISOString(),
            status: 'ACTIVE',
        });

        try {
            for (const machine of controllableMachines) {
                const commandResult = await tuyaClient.turnOn(machine.deviceId);
                await tuyaCommandLogsRepository.create({
                    laundrySessionId: session.id,
                    reservationId: reservation.id,
                    machineId: machine.id,
                    deviceId: machine.deviceId,
                    command: 'TURN_ON',
                    success: true,
                    responsePayload: commandResult as Record<string, unknown>,
                });
            }
        } catch (error) {
            await tuyaCommandLogsRepository.create({
                laundrySessionId: session.id,
                reservationId: reservation.id,
                machineId: null,
                deviceId: 'MULTI_DEVICE',
                command: 'TURN_ON',
                success: false,
                errorMessage: error instanceof Error ? error.message : 'Falha desconhecida ao energizar dispositivos.',
            });

            await laundrySessionsRepository.updateStatus({
                id: session.id,
                status: 'FORCED_FINISHED',
                finishedAt: new Date().toISOString(),
            });

            throw new AppError('Falha ao energizar par de maquinas no servico Tuya.', 502);
        }

        await reservationsRepository.updateStatus(reservation.id, 'IN_PROGRESS');

        await auditLogsRepository.add({
            actorUserId,
            action: 'RESERVATION_CHECKIN_COMPLETED',
            entity: 'laundry_sessions',
            entityId: session.id,
            payload: {
                reservationId: reservation.id,
                machinePairId: reservation.machine_pair_id,
                checkinAt: session.checkin_at,
                controlledMachinesCount: controllableMachines.length,
                controlledMachineIds: controllableMachines.map((machine) => machine.id),
            },
        });

        const view = await laundrySessionsRepository.findViewById(session.id);
        if (!view) {
            throw new AppError('Sessao criada, mas nao foi possivel carregar os detalhes.', 500);
        }

        return view;
    },

    async getSessionById(sessionId: string, actorUserId: string, isAdmin: boolean) {
        const session = await laundrySessionsRepository.findById(sessionId);
        if (!session) {
            throw new AppError('Sessao nao encontrada.', 404);
        }

        if (!isAdmin && session.user_id !== actorUserId) {
            throw new AppError('Acesso negado para consultar esta sessao.', 403);
        }

        const sessionView = await laundrySessionsRepository.findViewById(sessionId);
        if (!sessionView) {
            throw new AppError('Sessao nao encontrada.', 404);
        }

        const pair = await machinePairsRepository.findById(session.machine_pair_id);
        if (!pair) {
            throw new AppError('Par de maquinas da sessao nao encontrado.', 404);
        }

        const washer = await machinesRepository.findById(pair.washer_machine_id);
        const dryer = await machinesRepository.findById(pair.dryer_machine_id);
        if (!washer || !dryer) {
            throw new AppError('Maquinas da sessao nao encontradas.', 404);
        }

        const controllableMachines = [washer, dryer]
            .map(toControllableMachine)
            .filter((machine): machine is ControllableMachine => Boolean(machine));

        const devices = await Promise.all(controllableMachines.map(async (machine) => {
            const [status, consumption] = await Promise.all([
                tuyaClient.getStatus(machine.deviceId),
                tuyaClient.getConsumption(machine.deviceId),
            ]);

            return {
                machineId: machine.id,
                machineName: machine.name,
                machineType: machine.type,
                deviceId: machine.deviceId,
                isOn: status.isOn,
                powerWatts: consumption.powerWatts,
                energyKwh: consumption.energyKwh,
                sampledAt: consumption.sampledAt,
            };
        }));

        return {
            ...sessionView,
            devices,
        };
    },

    async getSessionByReservationId(reservationId: string, actorUserId: string, isAdmin: boolean) {
        const reservation = await reservationsRepository.findById(reservationId);
        if (!reservation) {
            throw new AppError('Reserva nao encontrada.', 404);
        }

        if (!isAdmin && reservation.user_id !== actorUserId) {
            throw new AppError('Acesso negado para consultar sessao desta reserva.', 403);
        }

        const session = await laundrySessionsRepository.findByReservationId(reservationId);
        if (!session) {
            throw new AppError('Sessao nao encontrada para a reserva.', 404);
        }

        const view = await laundrySessionsRepository.findViewById(session.id);
        if (!view) {
            throw new AppError('Sessao nao encontrada para a reserva.', 404);
        }

        return view;
    },

    async finishSession(sessionId: string, actorUserId: string, isAdmin: boolean): Promise<LaundrySessionView> {
        const session = await laundrySessionsRepository.findById(sessionId);
        if (!session) {
            throw new AppError('Sessao nao encontrada.', 404);
        }

        if (!isAdmin && session.user_id !== actorUserId) {
            throw new AppError('Acesso negado para finalizar esta sessao.', 403);
        }

        if (session.status !== 'ACTIVE') {
            throw new AppError('Sessao nao esta ativa para finalizacao.', 409);
        }

        const pair = await machinePairsRepository.findById(session.machine_pair_id);
        if (!pair) {
            throw new AppError('Par de maquinas da sessao nao encontrado.', 404);
        }

        const washer = await machinesRepository.findById(pair.washer_machine_id);
        const dryer = await machinesRepository.findById(pair.dryer_machine_id);
        if (!washer || !dryer) {
            throw new AppError('Maquinas da sessao nao encontradas.', 404);
        }

        const controllableMachines = [washer, dryer]
            .map(toControllableMachine)
            .filter((machine): machine is ControllableMachine => Boolean(machine));

        for (const machine of controllableMachines) {
            const consumption = await tuyaClient.getConsumption(machine.deviceId);
            await consumptionSamplesRepository.create({
                laundrySessionId: session.id,
                machineId: machine.id,
                sampleAt: consumption.sampledAt,
                powerWatts: parseNumeric(consumption.powerWatts),
                energyKwh: parseNumeric(consumption.energyKwh),
            });

            const turnOffResult = await tuyaClient.turnOff(machine.deviceId);
            await tuyaCommandLogsRepository.create({
                laundrySessionId: session.id,
                reservationId: session.reservation_id,
                machineId: machine.id,
                deviceId: machine.deviceId,
                command: 'TURN_OFF',
                success: true,
                responsePayload: turnOffResult as Record<string, unknown>,
            });
        }

        await laundrySessionsRepository.updateStatus({
            id: session.id,
            status: 'FINISHED',
            finishedAt: new Date().toISOString(),
        });

        await reservationsRepository.updateStatus(session.reservation_id, 'FINISHED');

        await auditLogsRepository.add({
            actorUserId,
            action: 'LAUNDRY_SESSION_FINISHED',
            entity: 'laundry_sessions',
            entityId: session.id,
            payload: {
                reservationId: session.reservation_id,
                finishedAt: new Date().toISOString(),
            },
        });

        const updatedView = await laundrySessionsRepository.findViewById(session.id);
        if (!updatedView) {
            throw new AppError('Sessao finalizada, mas nao foi possivel carregar os dados.', 500);
        }

        return updatedView;
    },
};
