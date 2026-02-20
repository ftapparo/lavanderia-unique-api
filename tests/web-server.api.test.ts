import type { Express } from 'express';
import { StartWebServer, swaggerUiOptions } from '../src/api/web-server.api';

describe('web-server.api', () => {
    it('fills missing request headers in swagger interceptor', () => {
        const request = swaggerUiOptions.swaggerOptions.requestInterceptor({} as any);

        expect(request.headers).toBeDefined();
        expect(request.headers['x-user']).toBe('SWAGGER');
        expect(String(request.headers['x-request-id'])).toContain('swagger-');
    });

    it('keeps existing headers object in swagger interceptor', () => {
        const request = swaggerUiOptions.swaggerOptions.requestInterceptor({
            headers: { existing: 'header' },
        } as any);

        expect(request.headers.existing).toBe('header');
        expect(request.headers['x-user']).toBe('SWAGGER');
    });

    it('starts server using provided app instance and logs startup', async () => {
        const listen = jest.fn((_: number | string, cb: () => void) => cb());
        const app = { listen } as unknown as Express;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const previousPort = process.env.PORT;
        process.env.PORT = '3999';

        await StartWebServer(app);

        expect(listen).toHaveBeenCalledWith('3999', expect.any(Function));
        expect(logSpy).toHaveBeenCalledWith('[Api] WebServer rodando na porta 3999');

        process.env.PORT = previousPort;
        logSpy.mockRestore();
    });

    it('starts with default app and fallback port when no args are provided', async () => {
        const previousPort = process.env.PORT;
        delete process.env.PORT;

        const server = await StartWebServer();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });

        process.env.PORT = previousPort;
    });
});
