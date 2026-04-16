import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';
import apiRoutes from '../routes/index.routes';
import { requestContextMiddleware } from '../middleware/request-context';
import { responseHandler } from '../middleware/response-handler';
import { errorHandler } from '../middleware/error-handler';
import { requestLoggerMiddleware } from '../middleware/request-logger';
import type { Express, RequestHandler } from 'express';
import type { Server as HttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const swaggerUiOptions = {
    swaggerOptions: {
        requestInterceptor: (request: any) => {
            request.headers = request.headers || {};
            request.headers['x-user'] = 'SWAGGER';
            request.headers['x-request-id'] = `swagger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            return request;
        }
    }
};

export function createApp(): Express {
    const app = express();

    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: '*',
        credentials: false
    }));

    app.options(/.*/, cors());
    app.use(express.json());
    app.use(requestContextMiddleware);
    app.use(responseHandler);
    app.use(requestLoggerMiddleware);

    app.use('/v1/api', apiRoutes);

    app.use('/v1/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

    app.get('/v1/openapi.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerDocument);
    });

    const notFoundHandler: RequestHandler = (_req, res) => {
        res.fail('Rota nao encontrada.', 404);
    };
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

const closeHttpServer = (server: HttpServer): Promise<void> => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
});

const startHttpsServer = async (app: Express): Promise<void> => {
    if (!env.httpsEnabled) {
        return;
    }

    if (!env.httpsKeyFile || !env.httpsCertFile) {
        throw new Error('HTTPS_ENABLED=true requires HTTPS_KEY_FILE and HTTPS_CERT_FILE.');
    }

    const httpsOptions = {
        key: readFileSync(env.httpsKeyFile),
        cert: readFileSync(env.httpsCertFile),
        ca: env.httpsCaFile ? readFileSync(env.httpsCaFile) : undefined,
    };

    const httpsServer = createHttpsServer(httpsOptions, app);
    await new Promise<void>((resolve, reject) => {
        httpsServer.once('error', reject);
        httpsServer.listen(env.httpsPort, () => {
            httpsServer.off('error', reject);
            resolve();
        });
    });
    logger.info('API_SERVER_STARTED', { protocol: 'https', port: env.httpsPort });
};

export async function StartWebServer(appInstance: Express = createApp()): Promise<HttpServer> {
    const app = appInstance;
    const port = process.env.PORT || env.port;

    const server = app.listen(port, () => {
        logger.info('API_SERVER_STARTED', { protocol: 'http', port });
    });

    try {
        await startHttpsServer(app);
    } catch (error) {
        await closeHttpServer(server);
        throw error;
    }

    return server;
}
