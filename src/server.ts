import dotenv from 'dotenv';
import { StartWebServer } from './api/web-server.api';
import { opsJobsService } from './services/ops-jobs.service';
import { logger } from './utils/logger';

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
    const error = dotenvResult.error as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
        logger.info('ENV_FILE_NOT_FOUND_USING_SYSTEM_ENV');
    } else {
        logger.error('ENV_FILE_LOAD_FAILED', { error: dotenvResult.error.message });
    }
} else {
    logger.info('ENV_FILE_LOADED');
}

async function StartService(): Promise<void> {
    try {
        await StartWebServer();
        opsJobsService.start();
        logger.info('SERVICE_STARTED');
    } catch (err) {
        logger.error('SERVICE_START_FAILED', { error: err instanceof Error ? err.message : err });
        process.exit(1);
    }
}

void StartService();
