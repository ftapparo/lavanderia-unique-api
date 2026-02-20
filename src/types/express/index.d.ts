import 'express-serve-static-core';

declare module 'express-serve-static-core' {
    interface Request {
        requestId?: string;
        actor?: string;
        auth?: {
            userId: string;
            role: string;
            tokenType: 'access' | 'refresh';
        };
    }

    interface Response {
        ok: <T>(data: T, status?: number) => this;
        fail: (message: string, status?: number, errors?: unknown) => this;
    }
}
