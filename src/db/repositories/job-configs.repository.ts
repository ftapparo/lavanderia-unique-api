import { db } from '../pool';

export type JobConfigRecord = {
    name: string;
    description: string;
    cron_expression: string;
    active: boolean;
    need_update: boolean;
    updated_by_user_id: string | null;
    updated_at: string;
};

export const jobConfigsRepository = {
    async list(): Promise<JobConfigRecord[]> {
        const result = await db.query<JobConfigRecord>(
            `SELECT name, description, cron_expression, active, need_update, updated_by_user_id, updated_at
             FROM job_configs
             ORDER BY name ASC`,
            [],
        );
        return result.rows;
    },

    async findByName(name: string): Promise<JobConfigRecord | null> {
        const result = await db.query<JobConfigRecord>(
            `SELECT name, description, cron_expression, active, need_update, updated_by_user_id, updated_at
             FROM job_configs
             WHERE name = $1`,
            [name],
        );
        return result.rows[0] ?? null;
    },

    async listPendingUpdate(): Promise<JobConfigRecord[]> {
        const result = await db.query<JobConfigRecord>(
            `SELECT name, description, cron_expression, active, need_update, updated_by_user_id, updated_at
             FROM job_configs
             WHERE need_update = TRUE`,
            [],
        );
        return result.rows;
    },

    async update(input: {
        name: string;
        description?: string;
        cronExpression?: string;
        active?: boolean;
        updatedByUserId: string;
    }): Promise<JobConfigRecord> {
        const shouldFlagSchedulerUpdate = input.cronExpression !== undefined || input.active !== undefined;
        const sets: string[] = ['updated_at = NOW()', 'updated_by_user_id = $2'];
        const params: unknown[] = [input.name, input.updatedByUserId];

        if (shouldFlagSchedulerUpdate) {
            sets.push('need_update = TRUE');
        }

        if (input.description !== undefined) {
            params.push(input.description);
            sets.push(`description = $${params.length}`);
        }
        if (input.cronExpression !== undefined) {
            params.push(input.cronExpression);
            sets.push(`cron_expression = $${params.length}`);
        }
        if (input.active !== undefined) {
            params.push(input.active);
            sets.push(`active = $${params.length}`);
        }

        const result = await db.query<JobConfigRecord>(
            `UPDATE job_configs
             SET ${sets.join(', ')}
             WHERE name = $1
             RETURNING name, description, cron_expression, active, need_update, updated_by_user_id, updated_at`,
            params,
        );

        if (!result.rows[0]) {
            throw new Error(`Job nao encontrado: ${input.name}`);
        }
        return result.rows[0];
    },

    async clearNeedUpdate(name: string): Promise<void> {
        await db.query(
            `UPDATE job_configs SET need_update = FALSE WHERE name = $1`,
            [name],
        );
    },
};
