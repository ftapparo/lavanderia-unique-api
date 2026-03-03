import cron, { type ScheduledTask } from 'node-cron';
import { consumptionSamplesRepository } from '../db/repositories/consumption-samples.repository';
import { incidentsRepository } from '../db/repositories/incidents.repository';
import { laundrySessionsRepository } from '../db/repositories/laundry-sessions.repository';
import { machinePairsRepository } from '../db/repositories/machine-pairs.repository';
import { machinesRepository } from '../db/repositories/machines.repository';
import { reservationsRepository } from '../db/repositories/reservations.repository';
import { systemSettingsRepository } from '../db/repositories/system-settings.repository';
import { tuyaCommandLogsRepository } from '../db/repositories/tuya-command-logs.repository';
import { tuyaClient } from '../integrations/tuya/tuya-client';
import type { MachineRecord } from '../types/domain.types';
import { billingService } from './billing.service';
import { logger } from '../utils/logger';

type ControllableMachine = {
    id: string;
    name: string;
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
        deviceId,
    };
};

const noShowCronExpression = process.env.JOB_NO_SHOW_CRON || '*/2 * * * *';
const reservationEndCronExpression = process.env.JOB_RESERVATION_END_CRON || '* * * * *';
const overtimeCronExpression = process.env.JOB_OVERTIME_MONITOR_CRON || '* * * * *';
const monthlyBillingCronExpression = process.env.JOB_MONTHLY_BILLING_CRON || '5 0 1 * *';
const criticalRetryAttempts = Number(process.env.JOB_RETRY_ATTEMPTS || 3);
const criticalRetryDelayMs = Number(process.env.JOB_RETRY_DELAY_MS || 500);

const isEnabled = (): boolean => {
    if ((process.env.NODE_ENV || '').toLowerCase() === 'test') {
        return false;
    }
    const raw = (process.env.JOBS_ENABLED || 'true').toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
};

const currentCompetence = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const processingLocks = new Set<string>();

type JobState = {
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastStatus: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'IDLE';
    lastError: string | null;
    runCount: number;
    successCount: number;
    errorCount: number;
};

const jobStateByName: Record<string, JobState> = {
    'no-show-detector': { lastStartedAt: null, lastFinishedAt: null, lastStatus: 'IDLE', lastError: null, runCount: 0, successCount: 0, errorCount: 0 },
    'reservation-end-handler': { lastStartedAt: null, lastFinishedAt: null, lastStatus: 'IDLE', lastError: null, runCount: 0, successCount: 0, errorCount: 0 },
    'overtime-monitor': { lastStartedAt: null, lastFinishedAt: null, lastStatus: 'IDLE', lastError: null, runCount: 0, successCount: 0, errorCount: 0 },
    'monthly-billing-generator': { lastStartedAt: null, lastFinishedAt: null, lastStatus: 'IDLE', lastError: null, runCount: 0, successCount: 0, errorCount: 0 },
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runWithLock = async (key: string, fn: () => Promise<void>): Promise<void> => {
    if (processingLocks.has(key)) {
        return;
    }
    processingLocks.add(key);
    try {
        await fn();
    } finally {
        processingLocks.delete(key);
    }
};

const retry = async (name: string, fn: () => Promise<void>): Promise<void> => {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt < criticalRetryAttempts) {
        try {
            await fn();
            return;
        } catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt >= criticalRetryAttempts) {
                throw error;
            }
            logger.warn('JOB_RETRY', {
                jobName: name,
                attempt,
                maxAttempts: criticalRetryAttempts,
                error: error instanceof Error ? error.message : error,
            });
            await wait(criticalRetryDelayMs * attempt);
        }
    }
    throw lastError;
};

const closeSessionAndReservation = async (input: {
    sessionId: string;
    reservationId: string;
    finishedAtIso: string;
    closeOvertime?: boolean;
}) => {
    await laundrySessionsRepository.updateStatus({
        id: input.sessionId,
        status: 'FINISHED',
        finishedAt: input.finishedAtIso,
    });
    if (input.closeOvertime) {
        await laundrySessionsRepository.markOvertimeEnded(input.sessionId, input.finishedAtIso);
    }
    await reservationsRepository.updateStatus(input.reservationId, 'FINISHED');
};

const evaluateAndShutdownSession = async (session: {
    id: string;
    reservationId: string;
    machinePairId: string;
    unitId: string;
    userId: string;
    overtimeStartedAt: string | null;
}, now: Date, thresholdWatts: number): Promise<'finished' | 'overtime' | 'skipped'> => {
    const pair = await machinePairsRepository.findById(session.machinePairId);
    if (!pair) {
        return 'skipped';
    }

    const [washer, dryer] = await Promise.all([
        machinesRepository.findById(pair.washer_machine_id),
        machinesRepository.findById(pair.dryer_machine_id),
    ]);
    if (!washer || !dryer) {
        return 'skipped';
    }

    const controllableMachines = [washer, dryer]
        .map(toControllableMachine)
        .filter((machine): machine is ControllableMachine => Boolean(machine));

    if (controllableMachines.length === 0) {
        await closeSessionAndReservation({
            sessionId: session.id,
            reservationId: session.reservationId,
            finishedAtIso: now.toISOString(),
            closeOvertime: Boolean(session.overtimeStartedAt),
        });
        await incidentsRepository.create({
            type: 'FORCED_SHUTDOWN',
            reservationId: session.reservationId,
            laundrySessionId: session.id,
            unitId: session.unitId,
            userId: session.userId,
            description: 'Sessao finalizada sem dispositivos Tuya elegiveis no par.',
            metadata: {
                reason: 'NO_CONTROLLABLE_MACHINES',
            },
        });
        return 'finished';
    }

    const consumptions = await Promise.all(controllableMachines.map(async (machine) => {
        const consumption = await tuyaClient.getConsumption(machine.deviceId);
        await consumptionSamplesRepository.create({
            laundrySessionId: session.id,
            machineId: machine.id,
            sampleAt: consumption.sampledAt,
            powerWatts: Number(consumption.powerWatts),
            energyKwh: Number(consumption.energyKwh),
        });
        return {
            ...machine,
            sampledAt: consumption.sampledAt,
            powerWatts: Number(consumption.powerWatts),
        };
    }));

    const hasActiveConsumption = consumptions.some((item) => item.powerWatts > thresholdWatts);
    if (hasActiveConsumption) {
        if (!session.overtimeStartedAt) {
            await laundrySessionsRepository.markOvertimeStarted(session.id, now.toISOString());
            await incidentsRepository.create({
                type: 'OVERTIME',
                reservationId: session.reservationId,
                laundrySessionId: session.id,
                unitId: session.unitId,
                userId: session.userId,
                description: 'Consumo acima do threshold apos o horario da reserva. Sessao entrou em overtime.',
                metadata: {
                    thresholdWatts,
                    readings: consumptions.map((item) => ({
                        machineId: item.id,
                        powerWatts: item.powerWatts,
                    })),
                },
            });
        }
        return 'overtime';
    }

    for (const machine of controllableMachines) {
        const result = await tuyaClient.turnOff(machine.deviceId);
        await tuyaCommandLogsRepository.create({
            laundrySessionId: session.id,
            reservationId: session.reservationId,
            machineId: machine.id,
            deviceId: machine.deviceId,
            command: 'TURN_OFF',
            success: true,
            responsePayload: result as Record<string, unknown>,
        });
    }

    await closeSessionAndReservation({
        sessionId: session.id,
        reservationId: session.reservationId,
        finishedAtIso: now.toISOString(),
        closeOvertime: Boolean(session.overtimeStartedAt),
    });
    return 'finished';
};

const runNoShowDetector = async (): Promise<void> => {
    const now = new Date();
    const candidates = await reservationsRepository.listNoShowCandidates(now.toISOString());
    for (const reservation of candidates) {
        await runWithLock(`reservation:${reservation.id}`, async () => {
            await retry('no-show-detector', async () => {
                await reservationsRepository.updateStatus(reservation.id, 'FINISHED');
                await incidentsRepository.create({
                    type: 'NO_SHOW',
                    reservationId: reservation.id,
                    unitId: reservation.unit_id,
                    userId: reservation.user_id,
                    description: 'Reserva encerrada automaticamente por ausencia de check-in.',
                    metadata: {
                        reservationStartAt: reservation.start_at,
                        reservationEndAt: reservation.end_at,
                        detectorRunAt: now.toISOString(),
                    },
                });
            });
        });
    }
};

const runReservationEndHandler = async (): Promise<void> => {
    const now = new Date();
    const settings = await systemSettingsRepository.get();
    const sessions = await laundrySessionsRepository.listActivePastReservationEnd(now.toISOString());

    for (const session of sessions) {
        await runWithLock(`session:${session.id}`, async () => {
            await retry('reservation-end-handler', async () => {
                await evaluateAndShutdownSession(session, now, settings.overtimeThresholdWatts);
            });
        });
    }
};

const runOvertimeMonitor = async (): Promise<void> => {
    const now = new Date();
    const settings = await systemSettingsRepository.get();
    const sessions = await laundrySessionsRepository.listActiveOvertimeSessions();
    for (const session of sessions) {
        await runWithLock(`session:${session.id}`, async () => {
            await retry('overtime-monitor', async () => {
                await evaluateAndShutdownSession(session, now, settings.overtimeThresholdWatts);
            });
        });
    }
};

const runMonthlyBillingGenerator = async (): Promise<void> => {
    const now = new Date();
    const competence = currentCompetence(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    await runWithLock(`billing:${competence}`, async () => {
        await retry('monthly-billing-generator', async () => {
            await billingService.run({ competence });
        });
    });
};

const guard = async (name: string, fn: () => Promise<void>) => {
    const state = jobStateByName[name];
    state.lastStartedAt = new Date().toISOString();
    state.lastStatus = 'RUNNING';
    state.runCount += 1;
    try {
        await fn();
        state.lastFinishedAt = new Date().toISOString();
        state.lastStatus = 'SUCCESS';
        state.lastError = null;
        state.successCount += 1;
    } catch (error) {
        state.lastFinishedAt = new Date().toISOString();
        state.lastStatus = 'ERROR';
        state.lastError = error instanceof Error ? error.message : String(error);
        state.errorCount += 1;
        logger.error('JOB_FAILED', {
            jobName: name,
            error: state.lastError,
        });
    }
};

class OpsJobsService {
    private tasks: ScheduledTask[] = [];
    private started = false;

    start(): void {
        if (this.started || !isEnabled()) {
            return;
        }

        this.tasks.push(
            cron.schedule(noShowCronExpression, () => {
                void guard('no-show-detector', runNoShowDetector);
            }),
            cron.schedule(reservationEndCronExpression, () => {
                void guard('reservation-end-handler', runReservationEndHandler);
            }),
            cron.schedule(overtimeCronExpression, () => {
                void guard('overtime-monitor', runOvertimeMonitor);
            }),
            cron.schedule(monthlyBillingCronExpression, () => {
                void guard('monthly-billing-generator', runMonthlyBillingGenerator);
            }),
        );

        this.started = true;
        logger.info('JOBS_SCHEDULER_STARTED', {
            noShowCronExpression,
            reservationEndCronExpression,
            overtimeCronExpression,
            monthlyBillingCronExpression,
        });
    }

    stop(): void {
        this.tasks.forEach((task) => task.stop());
        this.tasks = [];
        this.started = false;
    }

    async runNoShowDetectorNow(): Promise<void> {
        await runNoShowDetector();
    }

    async runReservationEndHandlerNow(): Promise<void> {
        await runReservationEndHandler();
    }

    async runOvertimeMonitorNow(): Promise<void> {
        await runOvertimeMonitor();
    }

    getStatus() {
        return {
            enabled: isEnabled(),
            started: this.started,
            jobs: jobStateByName,
            retry: {
                attempts: criticalRetryAttempts,
                baseDelayMs: criticalRetryDelayMs,
            },
        };
    }
}

export const opsJobsService = new OpsJobsService();
