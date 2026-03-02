import { db } from './pool';
import { runDevSeed } from './run-seed-dev';

runDevSeed()
    .then(async () => {
        await db.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[seed] Failed:', error);
        await db.close();
        process.exit(1);
    });
