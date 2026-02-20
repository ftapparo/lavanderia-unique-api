import request from 'supertest';
import { createApp } from '../src/api/web-server.api';

describe('Template API smoke', () => {
    const app = createApp();

    it('GET /v1/api/health returns 200', async () => {
        const response = await request(app).get('/v1/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            data: {
                status: expect.any(String),
                environment: expect.any(String),
            },
            message: null,
            errors: null,
        });
    });

    it('GET /v1/api/healthcheck returns 200', async () => {
        const response = await request(app).get('/v1/api/healthcheck');

        expect(response.status).toBe(200);
        expect(response.body?.data?.status).toBeDefined();
    });

    it('GET /v1/openapi.json returns OpenAPI JSON', async () => {
        const response = await request(app).get('/v1/openapi.json');

        expect(response.status).toBe(200);
        expect(response.type).toContain('application/json');
        expect(response.body).toHaveProperty('openapi');
        expect(response.body).toHaveProperty('paths');
    });

    it('GET /v1/swagger returns 200', async () => {
        const response = await request(app).get('/v1/swagger/');

        expect(response.status).toBe(200);
        expect(response.text).toContain('Swagger UI');
    });

    it('returns 404 for unknown route', async () => {
        const response = await request(app).get('/v1/unknown-route');
        expect(response.status).toBe(404);
    });
});
