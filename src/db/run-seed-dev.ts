import { db } from './pool';
import { hashPassword } from '../utils/password';

type SeedUser = {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'USER';
    password: string;
};

const DEV_USERS: SeedUser[] = [
    {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Admin Lavanderia',
        cpf: '00000000191',
        email: 'admin@unique.local',
        phone: '11999990001',
        role: 'ADMIN',
        password: 'Admin@123',
    },
    {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Morador Teste',
        cpf: '00000000272',
        email: 'morador@unique.local',
        phone: '11999990002',
        role: 'USER',
        password: 'User@123',
    },
];

const DEV_UNITS = [
    { id: '10000000-0000-4000-8000-000000000001', code: '1', floor: 0, unitNumber: 1, active: true },
    { id: '10000000-0000-4000-8000-000000000002', code: '2', floor: 0, unitNumber: 2, active: true },
    { id: '10000000-0000-4000-8000-000000000003', code: '3', floor: 1, unitNumber: 1, active: true },
];

const DEV_MACHINES = [
    { number: 1, brand: 'LG', model: 'WM11', type: 'WASHER' as const, active: true },
    { number: 2, brand: 'Samsung', model: 'WW10', type: 'WASHER' as const, active: true },
    { number: 3, brand: 'Brastemp', model: 'BW12', type: 'WASHER' as const, active: true },
    { number: 4, brand: 'LG', model: 'DRY10', type: 'DRYER' as const, active: true },
    { number: 5, brand: 'Samsung', model: 'DV10', type: 'DRYER' as const, active: true },
    { number: 6, brand: 'Brastemp', model: 'BD11', type: 'DRYER' as const, active: true },
];

const pairName = (index: number): string => `Par ${index}`;
const machineName = (number: number, brand: string, model: string): string => `#${number} ${brand} ${model}`;
const unitName = (floor: number, unitNumber: number): string => (floor === 0 ? `${unitNumber}` : `${floor}${unitNumber}`);

export async function runDevSeed(): Promise<void> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        for (const user of DEV_USERS) {
            await client.query(
                `INSERT INTO users (id, name, cpf, email, phone, password_hash, role)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (email) DO UPDATE
                 SET name = EXCLUDED.name,
                     cpf = EXCLUDED.cpf,
                     phone = EXCLUDED.phone,
                     password_hash = EXCLUDED.password_hash,
                     role = EXCLUDED.role,
                     updated_at = NOW()`,
                [user.id, user.name, user.cpf, user.email, user.phone, hashPassword(user.password), user.role],
            );
        }

        for (const unit of DEV_UNITS) {
            await client.query(
                `INSERT INTO units (id, name, code, floor, unit_number, active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (code) DO UPDATE
                 SET name = EXCLUDED.name,
                     floor = EXCLUDED.floor,
                     unit_number = EXCLUDED.unit_number,
                     active = EXCLUDED.active,
                     updated_at = NOW()`,
                [unit.id, unitName(unit.floor, unit.unitNumber), unit.code, unit.floor, unit.unitNumber, unit.active],
            );
        }

        const moradorId = DEV_USERS[1].id;
        for (const unit of DEV_UNITS) {
            await client.query(
                `INSERT INTO unit_memberships (user_id, unit_id, profile, start_date, end_date, active)
                 SELECT $1, $2, 'MORADOR', CURRENT_DATE - INTERVAL '30 day', NULL, true
                 WHERE NOT EXISTS (
                    SELECT 1
                    FROM unit_memberships
                    WHERE user_id = $1
                      AND unit_id = $2
                      AND profile = 'MORADOR'
                      AND end_date IS NULL
                 )`,
                [moradorId, unit.id],
            );
        }

        for (const machine of DEV_MACHINES) {
            await client.query(
                `INSERT INTO machines (number, brand, model, name, type, active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (number) DO UPDATE
                 SET brand = EXCLUDED.brand,
                     model = EXCLUDED.model,
                     name = EXCLUDED.name,
                     type = EXCLUDED.type,
                     active = EXCLUDED.active,
                     updated_at = NOW()`,
                [
                    machine.number,
                    machine.brand,
                    machine.model,
                    machineName(machine.number, machine.brand, machine.model),
                    machine.type,
                    machine.active,
                ],
            );
        }

        const machineRows = await client.query<{ id: string; number: number }>(
            `SELECT id, number FROM machines WHERE number BETWEEN 1 AND 6 ORDER BY number`,
        );
        const byNumber = new Map(machineRows.rows.map((row) => [row.number, row.id]));

        const pairs = [
            { name: pairName(1), washer: byNumber.get(1), dryer: byNumber.get(4) },
            { name: pairName(2), washer: byNumber.get(2), dryer: byNumber.get(5) },
            { name: pairName(3), washer: byNumber.get(3), dryer: byNumber.get(6) },
        ];

        for (const pair of pairs) {
            if (!pair.washer || !pair.dryer) {
                continue;
            }

            await client.query(
                `INSERT INTO machine_pairs (name, washer_machine_id, dryer_machine_id, active)
                 VALUES ($1, $2, $3, true)
                 ON CONFLICT (name) DO UPDATE
                 SET washer_machine_id = EXCLUDED.washer_machine_id,
                     dryer_machine_id = EXCLUDED.dryer_machine_id,
                     active = EXCLUDED.active,
                     updated_at = NOW()`,
                [pair.name, pair.washer, pair.dryer],
            );
        }

        await client.query('COMMIT');
        console.log('[seed] Development seed aplicado.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
