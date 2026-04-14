import cron from 'node-cron';
import { jobConfigsRepository } from '../db/repositories/job-configs.repository';
import { AppError } from '../utils/app-error';

const VALID_JOB_NAMES = new Set([
    'no-show-detector',
    'reservation-end-handler',
    'overtime-monitor',
    'monthly-billing-generator',
]);

export const jobConfigsService = {
    async list() {
        return jobConfigsRepository.list();
    },

    async update(input: {
        name: string;
        description?: string;
        cronExpression?: string;
        active?: boolean;
        actorUserId: string;
    }) {
        if (!VALID_JOB_NAMES.has(input.name)) {
            throw new AppError(`Job desconhecido: ${input.name}`, 404);
        }

        if (input.description !== undefined) {
            const normalizedDescription = input.description.trim();
            if (!normalizedDescription) {
                throw new AppError('Descricao do job nao pode ficar vazia.', 400);
            }
            input.description = normalizedDescription;
        }

        if (input.cronExpression !== undefined) {
            if (!cron.validate(input.cronExpression)) {
                throw new AppError('Expressao cron invalida.', 400);
            }
        }

        if (input.description === undefined && input.cronExpression === undefined && input.active === undefined) {
            throw new AppError('Nenhum campo para atualizar.', 400);
        }

        return jobConfigsRepository.update({
            name: input.name,
            description: input.description,
            cronExpression: input.cronExpression,
            active: input.active,
            updatedByUserId: input.actorUserId,
        });
    },
};
