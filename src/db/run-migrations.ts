import fs from 'fs';
import path from 'path';
import { db } from './pool';

async function run(): Promise<void> {
    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await db.query(content);
        console.log(`[migration] Applied ${file}`);
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
