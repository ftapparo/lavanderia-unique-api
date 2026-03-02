import { usersRepository } from '../db/repositories/users.repository';

export const usersService = {
    async list() {
        return usersRepository.listAll();
    },
};
