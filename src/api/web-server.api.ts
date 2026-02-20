import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';
import healthRoutes from '../routes/health.routes';
import type { Express } from 'express';
import type { Server } from 'http';

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

    app.use('/v1/api', healthRoutes);

    app.use('/v1/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

    app.get('/v1/openapi.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerDocument);
    });

    app.use((_req, res) => {
        res.status(404).send();
    });

    return app;
}

export async function StartWebServer(appInstance: Express = createApp()): Promise<Server> {
    const app = appInstance;
    const port = process.env.PORT || 3000;

    const server = app.listen(port, () => {
        console.log(`[Api] WebServer rodando na porta ${port}`);
    });

    return server;
}
