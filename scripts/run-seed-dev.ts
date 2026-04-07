import { db } from '../src/db/pool';
import { hashPassword } from '../src/utils/password';

type SeedUser = {
    name: string;
    cpf: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'USER' | 'SUPER';
    password: string;
};

type SeedUnit = {
    code: string;
    floor: number;
    unitNumber: number;
    active: boolean;
};

type SeedMembership = {
    userEmail: string;
    unitCode: string;
    slotPosition: 1;
    profile: 'PROPRIETARIO';
};

const DEV_USERS: SeedUser[] = [
    {
        name: 'SUPER ADMIN',
        cpf: '00000000000',
        email: 'admin@admin',
        phone: '00000000000',
        role: 'SUPER' as const,
        password: '123456',
    },
    {
        name: 'Mariana Oliveira',
        cpf: '11144477735',
        email: 'mariana.oliveira@gmail.com',
        phone: '11991234567',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Ricardo Almeida',
        cpf: '39053344705',
        email: 'ricardo.almeida@gmail.com',
        phone: '21999887766',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Fernanda Ribeiro',
        cpf: '16899535009',
        email: 'fernanda.ribeiro@gmail.com',
        phone: '11993456789',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Paulo Henrique Costa',
        cpf: '98765432100',
        email: 'paulo.costa@gmail.com',
        phone: '11995678901',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Juliana Martins',
        cpf: '12345678909',
        email: 'juliana.martins@gmail.com',
        phone: '21997766554',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Lucas Barbosa',
        cpf: '71460238001',
        email: 'lucas.barbosa@gmail.com',
        phone: '31998877665',
        role: 'USER',
        password: 'User@123',
    },
    {
        name: 'Patricia Nascimento',
        cpf: '24681357960',
        email: 'patricia.nascimento@gmail.com',
        phone: '11994561234',
        role: 'USER',
        password: 'User@123',
    },
];

const DEV_UNITS: SeedUnit[] = [
    { code: '1', floor: 0, unitNumber: 1, active: true },
    { code: '2', floor: 0, unitNumber: 2, active: true },
    { code: '3', floor: 1, unitNumber: 1, active: true },
    { code: '4', floor: 1, unitNumber: 2, active: true },
    { code: '5', floor: 2, unitNumber: 1, active: true },
    { code: '6', floor: 2, unitNumber: 2, active: true },
    { code: '7', floor: 3, unitNumber: 1, active: true },
    { code: '8', floor: 3, unitNumber: 2, active: true },
    { code: '9', floor: 4, unitNumber: 1, active: true },
    { code: '10', floor: 4, unitNumber: 2, active: true },
];

const DEV_MEMBERSHIPS: SeedMembership[] = [
    { userEmail: 'mariana.oliveira@gmail.com', unitCode: '1', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'mariana.oliveira@gmail.com', unitCode: '2', slotPosition: 1, profile: 'PROPRIETARIO' },

    { userEmail: 'ricardo.almeida@gmail.com', unitCode: '3', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'ricardo.almeida@gmail.com', unitCode: '4', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'ricardo.almeida@gmail.com', unitCode: '5', slotPosition: 1, profile: 'PROPRIETARIO' },

    { userEmail: 'fernanda.ribeiro@gmail.com', unitCode: '6', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'paulo.costa@gmail.com', unitCode: '7', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'juliana.martins@gmail.com', unitCode: '8', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'lucas.barbosa@gmail.com', unitCode: '9', slotPosition: 1, profile: 'PROPRIETARIO' },
    { userEmail: 'patricia.nascimento@gmail.com', unitCode: '10', slotPosition: 1, profile: 'PROPRIETARIO' },
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

        const userIdByEmail = new Map<string, string>();
        for (const user of DEV_USERS) {
            const result = await client.query<{ id: string }>(
                `INSERT INTO users (name, cpf, email, phone, password_hash, role)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO UPDATE
                 SET name = EXCLUDED.name,
                     cpf = EXCLUDED.cpf,
                     phone = EXCLUDED.phone,
                     password_hash = EXCLUDED.password_hash,
                     role = EXCLUDED.role,
                     updated_at = NOW()
                 RETURNING id`,
                [user.name, user.cpf, user.email, user.phone, hashPassword(user.password), user.role],
            );
            userIdByEmail.set(user.email, result.rows[0].id);
        }

        const unitIdByCode = new Map<string, string>();
        for (const unit of DEV_UNITS) {
            const result = await client.query<{ id: string }>(
                `INSERT INTO units (name, code, floor, unit_number, active)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (code) DO UPDATE
                 SET name = EXCLUDED.name,
                     floor = EXCLUDED.floor,
                     unit_number = EXCLUDED.unit_number,
                     active = EXCLUDED.active,
                     updated_at = NOW()
                 RETURNING id`,
                [unitName(unit.floor, unit.unitNumber), unit.code, unit.floor, unit.unitNumber, unit.active],
            );
            unitIdByCode.set(unit.code, result.rows[0].id);
        }

        const residentUserIds = DEV_USERS
            .filter((user) => user.role === 'USER')
            .map((user) => userIdByEmail.get(user.email))
            .filter((id): id is string => Boolean(id));

        if (residentUserIds.length > 0) {
            await client.query(
                `DELETE FROM unit_memberships WHERE user_id = ANY($1::uuid[])`,
                [residentUserIds],
            );
        }

        for (const membership of DEV_MEMBERSHIPS) {
            const userId = userIdByEmail.get(membership.userEmail);
            const unitId = unitIdByCode.get(membership.unitCode);
            if (!userId || !unitId) {
                throw new Error(`Seed inconsistente para vinculo: ${membership.userEmail} -> unidade ${membership.unitCode}`);
            }

            await client.query(
                `INSERT INTO unit_memberships (user_id, unit_id, slot_position, profile, start_date, end_date, active)
                 VALUES ($1, $2, $3, $4, CURRENT_DATE - INTERVAL '30 day', NULL, true)`,
                [userId, unitId, membership.slotPosition, membership.profile],
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
