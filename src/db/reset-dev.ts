import { db } from './pool';

async function run(): Promise<void> {
    await db.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await db.query('CREATE SCHEMA public;');
    await db.query('GRANT ALL ON SCHEMA public TO CURRENT_USER;');
    await db.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('[reset] Schema public recriado com sucesso.');
}

run()
    .then(async () => {
        await db.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[reset] Failed:', error);
        await db.close();
        process.exit(1);
    });
