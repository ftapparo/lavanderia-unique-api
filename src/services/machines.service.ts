import { machinesRepository } from '../db/repositories/machines.repository';
import type { MachineView } from '../types/domain.types';

export const machinesService = {
    async list(userId: string, isAdmin: boolean): Promise<MachineView[]> {
        if (isAdmin) {
            return machinesRepository.listAll();
        }

        return machinesRepository.listByUserId(userId);
    },
};
