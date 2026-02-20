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
};
