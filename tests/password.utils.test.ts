import { hashPassword, verifyPassword } from '../src/utils/password';

describe('password utils', () => {
    it('hashes and validates password', () => {
        const raw = 'MySecurePassword!123';
        const hash = hashPassword(raw);

        expect(hash).not.toBe(raw);
        expect(verifyPassword(raw, hash)).toBe(true);
        expect(verifyPassword('wrong', hash)).toBe(false);
    });
});
