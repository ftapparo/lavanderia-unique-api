import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';

let poolInstance: Pool | null = null;

const getPool = (): Pool => {
    if (!poolInstance) {
        poolInstance = new Pool({ connectionString: env.databaseUrl });
    }

    return poolInstance;
};

export const db = {
    query: <T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> => getPool().query<T>(text, params),
    connect: (): Promise<PoolClient> => getPool().connect(),
    close: async (): Promise<void> => {
        if (poolInstance) {
            await poolInstance.end();
            poolInstance = null;
        }
    },
};
