import { isCompetence, isUuid } from '../src/utils/validators';

describe('validators utils', () => {
    it('valida UUID corretamente', () => {
        expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(isUuid('invalido')).toBe(false);
        expect(isUuid('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false);
    });

    it('valida competencia YYYY-MM corretamente', () => {
        expect(isCompetence('2026-03')).toBe(true);
        expect(isCompetence('2026/03')).toBe(false);
        expect(isCompetence('26-03')).toBe(false);
    });
});

