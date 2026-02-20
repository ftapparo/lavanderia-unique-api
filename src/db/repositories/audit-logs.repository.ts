import { db } from '../pool';

export const auditLogsRepository = {
    async add(input: {
        actorUserId?: string | null;
        action: string;
        entity: string;
        entityId?: string | null;
        payload?: Record<string, unknown>;
    }): Promise<void> {
        await db.query(
            `INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, payload)
             VALUES ($1, $2, $3, $4, $5)`,
            [input.actorUserId ?? null, input.action, input.entity, input.entityId ?? null, JSON.stringify(input.payload ?? {})],
        );
    },
};
