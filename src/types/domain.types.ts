export type UserRole = 'USER' | 'ADMIN';

export type UserRecord = {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string | null;
    password_hash: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
};

export type UnitRecord = {
    id: string;
    name: string;
    code: string;
    floor: number | null;
    unit_number: number | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export type UnitMembershipRecord = {
    id: string;
    user_id: string;
    unit_id: string;
    profile: string;
    start_date: string;
    end_date: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export type RefreshTokenRecord = {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
};

export type AuditLogRecord = {
    id: string;
    actor_user_id: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
};

export type MembershipView = {
    id: string;
    userId: string;
    unitId: string;
    unitName: string;
    unitCode: string;
    profile: string;
    startDate: string;
    endDate: string | null;
    active: boolean;
};

export type UnitView = {
    id: string;
    name: string;
    code: string;
    floor: number | null;
    unitNumber: number | null;
    active: boolean;
};

export type MachineType = 'WASHER' | 'DRYER';

export type MachineRecord = {
    id: string;
    number: number;
    brand: string;
    model: string;
    name: string;
    type: MachineType;
    tuya_device_id: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export type MachineView = {
    id: string;
    number: number;
    brand: string;
    model: string;
    name: string;
    type: MachineType;
    active: boolean;
};

export type MachinePairRecord = {
    id: string;
    name: string;
    washer_machine_id: string;
    dryer_machine_id: string;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export type MachinePairView = {
    id: string;
    name: string;
    washerMachineId: string;
    washerMachineName: string;
    dryerMachineId: string;
    dryerMachineName: string;
    active: boolean;
};

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'IN_PROGRESS' | 'FINISHED';

export type ReservationRecord = {
    id: string;
    unit_id: string;
    machine_pair_id: string;
    user_id: string;
    start_at: string;
    end_at: string;
    status: ReservationStatus;
    canceled_at: string | null;
    canceled_by_user_id: string | null;
    created_at: string;
    updated_at: string;
};

export type ReservationView = {
    id: string;
    unitId: string;
    unitName: string;
    unitCode: string;
    machinePairId: string;
    machinePairName: string;
    userId: string;
    userName: string;
    startAt: string;
    endAt: string;
    status: ReservationStatus;
    canceledAt: string | null;
};
