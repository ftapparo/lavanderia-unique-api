import { db } from '../src/db/pool';
import { runProdSeed } from './run-seed-prod';

runProdSeed()
    .then(async () => {
        await db.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[seed] Failed:', error);
        await db.close();
        process.exit(1);
    });
