import { incidentsRepository } from '../db/repositories/incidents.repository';

export const incidentsService = {
    async list(userId: string, isAdmin: boolean) {
        if (isAdmin) {
            return incidentsRepository.listAll();
        }
        return incidentsRepository.listByUserId(userId);
    },
};
