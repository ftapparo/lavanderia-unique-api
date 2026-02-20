import { createHmac } from 'crypto';

export type JwtPayload = {
    sub: string;
    role: string;
    type: 'access' | 'refresh';
    iat: number;
    exp: number;
};

const toBase64Url = (input: string): string => Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const fromBase64Url = (input: string): string => {
    const base64 = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(input.length / 4) * 4, '=');
    return Buffer.from(base64, 'base64').toString('utf-8');
};

export const signJwt = (payload: Omit<JwtPayload, 'iat' | 'exp'>, ttlSeconds: number, secret: string): string => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const body: JwtPayload = {
        ...payload,
        iat,
        exp: iat + ttlSeconds,
    };

    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedBody = toBase64Url(JSON.stringify(body));
    const signature = createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedBody}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${encodedHeader}.${encodedBody}.${signature}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload => {
    const [encodedHeader, encodedBody, signature] = token.split('.');

    if (!encodedHeader || !encodedBody || !signature) {
        throw new Error('Token invalido');
    }

    const expectedSignature = createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedBody}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    if (expectedSignature !== signature) {
        throw new Error('Assinatura invalida');
    }

    const payload = JSON.parse(fromBase64Url(encodedBody)) as JwtPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expirado');
    }

    return payload;
};
