import { signJwt, verifyJwt } from '../src/utils/jwt';

describe('jwt utils', () => {
    const secret = 'test-secret';

    it('signs and verifies access token', () => {
        const token = signJwt({ sub: 'user-1', role: 'USER', type: 'access' }, 3600, secret);
        const payload = verifyJwt(token, secret);

        expect(payload.sub).toBe('user-1');
        expect(payload.role).toBe('USER');
        expect(payload.type).toBe('access');
    });

    it('rejects invalid signature', () => {
        const token = signJwt({ sub: 'user-1', role: 'USER', type: 'access' }, 3600, secret);
        expect(() => verifyJwt(token, 'other-secret')).toThrow('Assinatura invalida');
    });
});
