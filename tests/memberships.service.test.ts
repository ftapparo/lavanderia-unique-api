import { membershipsService } from '../src/services/memberships.service';
import { db } from '../src/db/pool';
import { membershipsRepository } from '../src/db/repositories/memberships.repository';
import { unitsRepository } from '../src/db/repositories/units.repository';
import { usersRepository } from '../src/db/repositories/users.repository';
import { auditLogsRepository } from '../src/db/repositories/audit-logs.repository';

describe('memberships.service slots', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('blocks save when slot 1 is missing proprietario', async () => {
        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        await expect(membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'user-1', profile: 'LOCATARIO', startDate: '2026-01-01', endDate: null },
            { slotPosition: 2, userId: null, profile: null, startDate: null, endDate: null },
            { slotPosition: 3, userId: null, profile: null, startDate: null, endDate: null },
        ], 'actor-1')).rejects.toMatchObject({ status: 400 });
    });

    it('saves slots in transaction and returns mapped slots', async () => {
        const nowIso = new Date().toISOString();
        const todayIso = new Date().toISOString().slice(0, 10);

        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        jest.spyOn(usersRepository, 'findById').mockResolvedValue({
            id: 'user-1',
            name: 'Owner',
            cpf: '000',
            email: 'owner@example.com',
            phone: null,
            password_hash: 'x',
            pin_hash: null,
            role: 'USER',
            cargo: null,
            must_change_password: false,
            profile_photo: null,
            profile_photo_mime: null,
            created_at: nowIso,
            updated_at: nowIso,
        });

        jest.spyOn(membershipsRepository, 'profileExists').mockResolvedValue(true);
        jest.spyOn(membershipsRepository, 'hasOverlappingLocatarioForUser').mockResolvedValue(false);
        jest.spyOn(membershipsRepository, 'findCurrentByUnitAndSlotOnDate').mockImplementation(async (input) => {
            if (!input) return null;
            if (input.slotPosition === 1 && input.dateIso === todayIso) {
                return {
                    id: 'm-slot-1',
                    user_id: 'user-1',
                    unit_id: 'unit-1',
                    slot_position: 1,
                    profile: 'PROPRIETARIO',
                    start_date: '2026-01-01',
                    end_date: null,
                    active: true,
                    created_at: nowIso,
                    updated_at: nowIso,
                };
            }
            return null;
        });
        jest.spyOn(membershipsRepository, 'closeActiveByUnitAndSlot').mockResolvedValue(undefined);
        jest.spyOn(membershipsRepository, 'hasOverlappingMembershipOnSlot').mockResolvedValue(false);
        jest.spyOn(membershipsRepository, 'create').mockResolvedValue({
            id: 'm-new',
            user_id: 'user-1',
            unit_id: 'unit-1',
            slot_position: 1,
            profile: 'PROPRIETARIO',
            start_date: '2026-01-01',
            end_date: null,
            active: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        jest.spyOn(membershipsRepository, 'listByUnitId').mockResolvedValue([
            {
                id: 'm-new',
                userId: 'user-1',
                userName: 'Owner',
                userCpf: '000',
                unitId: 'unit-1',
                unitName: '11',
                unitCode: '11',
                slotPosition: 1,
                profile: 'PROPRIETARIO',
                startDate: '2026-01-01',
                endDate: null,
                active: true,
            },
        ]);

        jest.spyOn(auditLogsRepository, 'add').mockResolvedValue(undefined);

        const client = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        jest.spyOn(db, 'connect').mockResolvedValue(client as any);

        const result = await membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'user-1', profile: 'PROPRIETARIO', startDate: '2026-01-01', endDate: null },
            { slotPosition: 2, userId: null, profile: null, startDate: null, endDate: null },
            { slotPosition: 3, userId: null, profile: null, startDate: null, endDate: null },
        ], 'actor-1');

        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(result).toHaveLength(3);
        expect(result[0].slotPosition).toBe(1);
        expect(result[0].current?.profile).toBe('PROPRIETARIO');
        expect(result[0].current?.userCpf).toBe('000');
    });

    it('blocks duplicate user in active slots', async () => {
        const nowIso = new Date().toISOString();
        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        await expect(membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'user-1', profile: 'PROPRIETARIO', startDate: '2026-01-01', endDate: null },
            { slotPosition: 2, userId: 'user-1', profile: 'LOCATARIO', startDate: '2026-01-02', endDate: null },
            { slotPosition: 3, userId: null, profile: null, startDate: null, endDate: null },
        ], 'actor-1')).rejects.toMatchObject({ status: 409 });
    });

    it('blocks ADMINISTRADOR in slot 3', async () => {
        const nowIso = new Date().toISOString();
        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        await expect(membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'user-1', profile: 'PROPRIETARIO', startDate: '2026-01-01', endDate: null },
            { slotPosition: 2, userId: null, profile: null, startDate: null, endDate: null },
            { slotPosition: 3, userId: 'user-3', profile: 'ADMINISTRADOR', startDate: '2026-01-02', endDate: null },
        ], 'actor-1')).rejects.toMatchObject({ status: 400 });
    });

    it('blocks owner change when slot 2 or 3 is filled', async () => {
        const nowIso = new Date().toISOString();
        const todayIso = new Date().toISOString().slice(0, 10);

        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        jest.spyOn(membershipsRepository, 'findCurrentByUnitAndSlotOnDate').mockImplementation(async (input) => {
            if (!input) return null;
            if (input.slotPosition === 1 && input.dateIso === todayIso) {
                return {
                    id: 'm-slot-1',
                    user_id: 'owner-old',
                    unit_id: 'unit-1',
                    slot_position: 1,
                    profile: 'PROPRIETARIO',
                    start_date: '2026-01-01',
                    end_date: null,
                    active: true,
                    created_at: nowIso,
                    updated_at: nowIso,
                };
            }
            return null;
        });

        await expect(membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'owner-new', profile: 'PROPRIETARIO', startDate: '2026-02-01', endDate: null },
            { slotPosition: 2, userId: 'user-2', profile: 'HOSPEDE', startDate: '2026-02-01', endDate: '2026-02-10' },
            { slotPosition: 3, userId: null, profile: null, startDate: null, endDate: null },
        ], 'actor-1')).rejects.toMatchObject({ status: 409 });
    });

    it('blocks removing ADMINISTRADOR from slot 2 when slot 3 is filled', async () => {
        const nowIso = new Date().toISOString();
        const todayIso = new Date().toISOString().slice(0, 10);

        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        jest.spyOn(membershipsRepository, 'findCurrentByUnitAndSlotOnDate').mockImplementation(async (input) => {
            if (!input) return null;
            if (input.slotPosition === 1 && input.dateIso === todayIso) {
                return {
                    id: 'm-slot-1',
                    user_id: 'owner',
                    unit_id: 'unit-1',
                    slot_position: 1,
                    profile: 'PROPRIETARIO',
                    start_date: '2026-01-01',
                    end_date: null,
                    active: true,
                    created_at: nowIso,
                    updated_at: nowIso,
                };
            }
            if (input.slotPosition === 2 && input.dateIso === todayIso) {
                return {
                    id: 'm-slot-2',
                    user_id: 'admin-1',
                    unit_id: 'unit-1',
                    slot_position: 2,
                    profile: 'ADMINISTRADOR',
                    start_date: '2026-01-01',
                    end_date: null,
                    active: true,
                    created_at: nowIso,
                    updated_at: nowIso,
                };
            }
            return null;
        });

        await expect(membershipsService.saveUnitSlots('unit-1', [
            { slotPosition: 1, userId: 'owner', profile: 'PROPRIETARIO', startDate: '2026-01-01', endDate: null },
            { slotPosition: 2, userId: null, profile: null, startDate: null, endDate: null },
            { slotPosition: 3, userId: 'user-3', profile: 'LOCATARIO', startDate: '2026-02-01', endDate: null },
        ], 'actor-1')).rejects.toMatchObject({ status: 409 });
    });

    it('blocks legacy create in slot 2 when unit has no slot-1 owner', async () => {
        const nowIso = new Date().toISOString();
        jest.spyOn(usersRepository, 'findById').mockResolvedValue({
            id: 'user-2',
            name: 'Tenant',
            cpf: '111',
            email: 'tenant@example.com',
            phone: null,
            password_hash: 'x',
            pin_hash: null,
            role: 'USER',
            cargo: null,
            must_change_password: false,
            profile_photo: null,
            profile_photo_mime: null,
            created_at: nowIso,
            updated_at: nowIso,
        });
        jest.spyOn(unitsRepository, 'findById').mockResolvedValue({
            id: 'unit-1',
            name: '11',
            code: '11',
            floor: 1,
            unit_number: 1,
            active: true,
            allow_guest_reservations: true,
            created_at: nowIso,
            updated_at: nowIso,
        });
        jest.spyOn(membershipsRepository, 'profileExists').mockResolvedValue(true);
        jest.spyOn(membershipsRepository, 'listByUnitId').mockResolvedValue([]);

        await expect(membershipsService.create({
            userId: 'user-2',
            unitId: 'unit-1',
            slotPosition: 2,
            profile: 'LOCATARIO',
            startDate: '2026-01-10',
            endDate: null,
            active: true,
        }, 'actor-1')).rejects.toMatchObject({ status: 400 });
    });
});
