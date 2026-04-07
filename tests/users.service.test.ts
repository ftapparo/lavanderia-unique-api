import { usersService } from '../src/services/users.service';
import { usersRepository } from '../src/db/repositories/users.repository';

describe('users.service list filters', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('passes q, unitId, slot and profile filters to repository', async () => {
        const repoSpy = jest.spyOn(usersRepository, 'listAll').mockResolvedValue([]);

        await usersService.list({
            q: 'maria',
            unitId: 'unit-1',
            slotPosition: 2,
            profile: 'locatario',
        });

        expect(repoSpy).toHaveBeenCalledWith({
            q: 'maria',
            unitId: 'unit-1',
            slotPosition: 2,
            profile: 'LOCATARIO',
        });
    });

    it('blocks invalid slot position filter', async () => {
        await expect(usersService.list({ slotPosition: 4 })).rejects.toMatchObject({ status: 400 });
    });

    it('blocks invalid profile filter', async () => {
        await expect(usersService.list({ profile: 'INVALIDO' })).rejects.toMatchObject({ status: 400 });
    });

    it('blocks non-owner profile in slot 1 filter', async () => {
        await expect(usersService.list({ slotPosition: 1, profile: 'LOCATARIO' })).rejects.toMatchObject({ status: 400 });
    });

    it('blocks ADMINISTRADOR profile in slot 3 filter', async () => {
        await expect(usersService.list({ slotPosition: 3, profile: 'ADMINISTRADOR' })).rejects.toMatchObject({ status: 400 });
    });
});
