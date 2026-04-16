import cron, { type ScheduledTask } from 'node-cron';
import { consumptionSamplesRepository } from '../db/repositories/consumption-samples.repository';
import { incidentsRepository } from '../db/repositories/incidents.repository';
import { jobConfigsRepository } from '../db/repositories/job-configs.repository';
import { laundrySessionsRepository } from '../db/repositories/laundry-sessions.repository';
import { machineMaintenancesRepository } from '../db/repositories/machine-maintenances.repository';
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
    if (!machine.active) return null;
    const deviceId = machine.tuya_device_id?.trim();
    if (!deviceId) return null;
    return { id: machine.id, name: machine.name, deviceId };
};

// Defaults (env fallback)
const JOB_DEFAULTS: Record<string, { cron: string; active: boolean }> = {
    'no-show-detector':         { cron: process.env.JOB_NO_SHOW_CRON             || '*/2 * * * *', active: true },
    'reservation-end-handler':  { cron: process.env.JOB_RESERVATION_END_CRON     || '* * * * *',   active: true },
    'overtime-monitor':         { cron: process.env.JOB_OVERTIME_MONITOR_CRON    || '* * * * *',   active: true },
    'monthly-billing-generator':{ cron: process.env.JOB_MONTHLY_BILLING_CRON     || '5 0 1 * *',   active: true },
    'maintenance-activator':    { cron: process.env.JOB_MAINTENANCE_ACTIVATOR_CRON || '* * * * *', active: true },
};

const criticalRetryAttempts = Number(process.env.JOB_RETRY_ATTEMPTS || 3);
const criticalRetryDelayMs  = Number(process.env.JOB_RETRY_DELAY_MS  || 500);

const isEnabled = (): boolean => {
    if ((process.env.NODE_ENV || '').toLowerCase() === 'test') return false;
    const raw = (process.env.JOBS_ENABLED || 'true').toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
};

const currentCompetence = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const processingLocks = new Set<string>();

type JobState = {
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastStatus: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'IDLE';
    lastError: string | null;
    runCount: number;
    successCount: number;
    errorCount: number;
    cronExpression: string;
    active: boolean;
};

const jobStateByName: Record<string, JobState> = {
    'no-show-detector':          { ...emptyState(), cronExpression: JOB_DEFAULTS['no-show-detector'].cron,          active: true },
    'reservation-end-handler':   { ...emptyState(), cronExpression: JOB_DEFAULTS['reservation-end-handler'].cron,   active: true },
    'overtime-monitor':          { ...emptyState(), cronExpression: JOB_DEFAULTS['overtime-monitor'].cron,          active: true },
    'monthly-billing-generator': { ...emptyState(), cronExpression: JOB_DEFAULTS['monthly-billing-generator'].cron, active: true },
    'maintenance-activator':     { ...emptyState(), cronExpression: JOB_DEFAULTS['maintenance-activator'].cron,     active: true },
};

function emptyState(): Omit<JobState, 'cronExpression' | 'active'> {
    return {
        lastStartedAt: null,
        lastFinishedAt: null,
        lastStatus: 'IDLE',
        lastError: null,
        runCount: 0,
        successCount: 0,
        errorCount: 0,
    };
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runWithLock = async (key: string, fn: () => Promise<void>): Promise<void> => {
    if (processingLocks.has(key)) return;
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
            if (attempt >= criticalRetryAttempts) throw error;
            logger.warn('JOB_RETRY', { jobName: name, attempt, maxAttempts: criticalRetryAttempts, error: error instanceof Error ? error.message : error });
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
    await laundrySessionsRepository.updateStatus({ id: input.sessionId, status: 'FINISHED', finishedAt: input.finishedAtIso });
    if (input.closeOvertime) await laundrySessionsRepository.markOvertimeEnded(input.sessionId, input.finishedAtIso);
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
    if (!pair) return 'skipped';

    const [washer, dryer] = await Promise.all([
        machinesRepository.findById(pair.washer_machine_id),
        machinesRepository.findById(pair.dryer_machine_id),
    ]);
    if (!washer || !dryer) return 'skipped';

    const controllableMachines = [washer, dryer]
        .map(toControllableMachine)
        .filter((machine): machine is ControllableMachine => Boolean(machine));

    if (controllableMachines.length === 0) {
        await closeSessionAndReservation({ sessionId: session.id, reservationId: session.reservationId, finishedAtIso: now.toISOString(), closeOvertime: Boolean(session.overtimeStartedAt) });
        await incidentsRepository.create({ type: 'FORCED_SHUTDOWN', reservationId: session.reservationId, laundrySessionId: session.id, unitId: session.unitId, userId: session.userId, description: 'Sessao finalizada sem dispositivos Tuya elegiveis no par.', metadata: { reason: 'NO_CONTROLLABLE_MACHINES' } });
        return 'finished';
    }

    const consumptions = await Promise.all(controllableMachines.map(async (machine) => {
        const consumption = await tuyaClient.getConsumption(machine.deviceId);
        await consumptionSamplesRepository.create({ laundrySessionId: session.id, machineId: machine.id, sampleAt: consumption.sampledAt, powerWatts: Number(consumption.powerWatts), energyKwh: Number(consumption.energyKwh) });
        return { ...machine, sampledAt: consumption.sampledAt, powerWatts: Number(consumption.powerWatts) };
    }));

    const hasActiveConsumption = consumptions.some((item) => item.powerWatts > thresholdWatts);
    if (hasActiveConsumption) {
        if (!session.overtimeStartedAt) {
            await laundrySessionsRepository.markOvertimeStarted(session.id, now.toISOString());
            await incidentsRepository.create({ type: 'OVERTIME', reservationId: session.reservationId, laundrySessionId: session.id, unitId: session.unitId, userId: session.userId, description: 'Consumo acima do threshold apos o horario da reserva. Sessao entrou em overtime.', metadata: { thresholdWatts, readings: consumptions.map((item) => ({ machineId: item.id, powerWatts: item.powerWatts })) } });
        }
        return 'overtime';
    }

    for (const machine of controllableMachines) {
        const result = await tuyaClient.turnOff(machine.deviceId);
        await tuyaCommandLogsRepository.create({ laundrySessionId: session.id, reservationId: session.reservationId, machineId: machine.id, deviceId: machine.deviceId, command: 'TURN_OFF', success: true, responsePayload: result as Record<string, unknown> });
    }

    await closeSessionAndReservation({ sessionId: session.id, reservationId: session.reservationId, finishedAtIso: now.toISOString(), closeOvertime: Boolean(session.overtimeStartedAt) });
    return 'finished';
};

// ---- Job runners ----

const runNoShowDetector = async (): Promise<void> => {
    const now = new Date();
    const candidates = await reservationsRepository.listNoShowCandidates(now.toISOString());
    for (const reservation of candidates) {
        await runWithLock(`reservation:${reservation.id}`, async () => {
            await retry('no-show-detector', async () => {
                await reservationsRepository.updateStatus(reservation.id, 'FINISHED');
                await incidentsRepository.create({ type: 'NO_SHOW', reservationId: reservation.id, unitId: reservation.unit_id, userId: reservation.user_id, description: 'Reserva encerrada automaticamente por ausencia de check-in.', metadata: { reservationStartAt: reservation.start_at, reservationEndAt: reservation.end_at, detectorRunAt: now.toISOString() } });
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

const runMaintenanceActivator = async (): Promise<void> => {
    const now = new Date();
    const pending = await machineMaintenancesRepository.listPendingActivation(now.toISOString());
    for (const maintenance of pending) {
        await runWithLock(`maintenance:${maintenance.machine_id}`, async () => {
            await retry('maintenance-activator', async () => {
                await machinesRepository.setStatus(maintenance.machine_id, 'MAINTENANCE');

                const pair = await machinePairsRepository.findByMachineId(maintenance.machine_id);
                if (pair) {
                    const partnerMachineId = pair.washer_machine_id === maintenance.machine_id
                        ? pair.dryer_machine_id
                        : pair.washer_machine_id;
                    await machinesRepository.setStatus(partnerMachineId, 'MAINTENANCE');
                }

                logger.info('MAINTENANCE_ACTIVATED', { maintenanceId: maintenance.id, machineId: maintenance.machine_id });
            });
        });
    }
};

const JOB_RUNNERS: Record<string, () => Promise<void>> = {
    'no-show-detector':          runNoShowDetector,
    'reservation-end-handler':   runReservationEndHandler,
    'overtime-monitor':          runOvertimeMonitor,
    'monthly-billing-generator': runMonthlyBillingGenerator,
    'maintenance-activator':     runMaintenanceActivator,
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
        logger.error('JOB_FAILED', { jobName: name, error: state.lastError });
    }
};

// ---- OpsJobsService ----

class OpsJobsService {
    private tasks: Map<string, ScheduledTask> = new Map();
    private watcherTask: ScheduledTask | null = null;
    private started = false;

    async start(): Promise<void> {
        if (this.started || !isEnabled()) return;

        // Load initial config from DB (fallback to defaults if table not populated)
        const configs = await this._loadConfigs();

        for (const [name, runner] of Object.entries(JOB_RUNNERS)) {
            const config = configs[name];
            if (!config.active) {
                logger.info('JOB_SKIPPED_INACTIVE', { jobName: name });
                continue;
            }
            this._scheduleJob(name, config.cron, runner);
        }

        // Watcher: polls DB every minute for need_update flags
        this.watcherTask = cron.schedule('* * * * *', () => {
            void this._applyPendingUpdates();
        });

        this.started = true;
        logger.info('JOBS_SCHEDULER_STARTED', { jobs: Object.fromEntries(Object.entries(configs).map(([k, v]) => [k, v.cron])) });
    }

    stop(): void {
        this.tasks.forEach((task) => task.stop());
        this.tasks.clear();
        this.watcherTask?.stop();
        this.watcherTask = null;
        this.started = false;
    }

    private _scheduleJob(name: string, cronExpr: string, runner: () => Promise<void>): void {
        const existing = this.tasks.get(name);
        if (existing) {
            existing.stop();
            this.tasks.delete(name);
        }

        const task = cron.schedule(cronExpr, () => {
            void guard(name, runner);
        });

        this.tasks.set(name, task);
        jobStateByName[name].cronExpression = cronExpr;
        jobStateByName[name].active = true;
    }

    private _stopJob(name: string): void {
        const existing = this.tasks.get(name);
        if (existing) {
            existing.stop();
            this.tasks.delete(name);
        }
        jobStateByName[name].active = false;
    }

    private async _loadConfigs(): Promise<Record<string, { cron: string; active: boolean }>> {
        const result: Record<string, { cron: string; active: boolean }> = { ...JOB_DEFAULTS };
        try {
            const rows = await jobConfigsRepository.list();
            for (const row of rows) {
                result[row.name] = { cron: row.cron_expression, active: row.active };
                if (jobStateByName[row.name]) {
                    jobStateByName[row.name].cronExpression = row.cron_expression;
                    jobStateByName[row.name].active = row.active;
                }
            }
        } catch (err) {
            logger.warn('JOBS_DB_CONFIG_LOAD_FAILED', { error: err instanceof Error ? err.message : err });
        }
        return result;
    }

    private async _applyPendingUpdates(): Promise<void> {
        try {
            const pending = await jobConfigsRepository.listPendingUpdate();
            for (const row of pending) {
                const runner = JOB_RUNNERS[row.name];
                if (!runner) continue;

                if (row.active) {
                    if (!cron.validate(row.cron_expression)) {
                        logger.error('JOB_INVALID_CRON', { jobName: row.name, cron: row.cron_expression });
                    } else {
                        this._scheduleJob(row.name, row.cron_expression, runner);
                        logger.info('JOB_UPDATED', { jobName: row.name, newCron: row.cron_expression });
                    }
                } else {
                    this._stopJob(row.name);
                    logger.info('JOB_DEACTIVATED', { jobName: row.name });
                }

                await jobConfigsRepository.clearNeedUpdate(row.name);
            }
        } catch (err) {
            logger.error('JOBS_WATCHER_FAILED', { error: err instanceof Error ? err.message : err });
        }
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
