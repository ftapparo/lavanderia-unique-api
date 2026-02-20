import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';
import apiRoutes from '../routes/index.routes';
import { requestContextMiddleware } from '../middleware/request-context';
import { responseHandler } from '../middleware/response-handler';
import { errorHandler } from '../middleware/error-handler';
import type { Express, RequestHandler } from 'express';
import type { Server } from 'http';
import { env } from '../config/env';

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

export async function StartWebServer(appInstance: Express = createApp()): Promise<Server> {
    const app = appInstance;
    const port = process.env.PORT || env.port;

    const server = app.listen(port, () => {
        console.log(`[Api] WebServer rodando na porta ${port}`);
    });

    return server;
}
