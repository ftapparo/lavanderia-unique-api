import { createHash, pbkdf2Sync, timingSafeEqual } from 'crypto';

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export const hashPassword = (password: string): string => {
    const salt = createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex');
    const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return `${ITERATIONS}:${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
    const [iterationsRaw, salt, hash] = stored.split(':');
    const iterations = Number(iterationsRaw);

    if (!iterations || !salt || !hash) {
        return false;
    }

    const passwordHash = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString('hex');
    const a = Buffer.from(passwordHash, 'hex');
    const b = Buffer.from(hash, 'hex');

    if (a.length !== b.length) {
        return false;
    }

    return timingSafeEqual(a, b);
};
