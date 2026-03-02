import fs from 'fs';
import path from 'path';
import { db } from './pool';
import { runDevSeed } from './run-seed-dev';

async function run(): Promise<void> {
    await db.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGSERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    );

    const applied = await db.query<{ filename: string }>(
        `SELECT filename FROM schema_migrations`,
    );
    const appliedSet = new Set(applied.rows.map((row) => row.filename));

    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const file of files) {
        if (appliedSet.has(file)) {
            console.log(`[migration] Skipped ${file} (already applied)`);
            continue;
        }

        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query(content);
            await client.query(
                `INSERT INTO schema_migrations (filename) VALUES ($1)`,
                [file],
            );
            await client.query('COMMIT');
            console.log(`[migration] Applied ${file}`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    if ((process.env.NODE_ENV || 'development') === 'development') {
        await runDevSeed();
    }
}

run()
    .then(async () => {
        await db.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[migration] Failed:', error);
        await db.close();
        process.exit(1);
    });
