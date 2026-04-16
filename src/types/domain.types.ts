export type UserRole = 'USER' | 'ADMIN' | 'SUPER';

export type UserRecord = {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string | null;
    password_hash: string | null;
    pin_hash: string | null;
    role: UserRole;
    cargo: string | null;
    must_change_password: boolean;
    profile_photo: Buffer | null;
    profile_photo_mime: string | null;
    created_at: string;
    updated_at: string;
};

export type UserView = {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string | null;
    role: UserRole;
    cargo: string | null;
    mustChangePassword: boolean;
    hasProfilePhoto?: boolean;
    profilePhotoBase64?: string | null;
    profilePhotoMime?: string | null;
    createdAt: string;
};

export type UnitRecord = {
    id: string;
    name: string;
    code: string;
    floor: number | null;
    unit_number: number | null;
    active: boolean;
    allow_guest_reservations: boolean;
    created_at: string;
    updated_at: string;
};

export type UnitMembershipRecord = {
    id: string;
    user_id: string;
    unit_id: string;
    slot_position: number;
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
    userName?: string;
    userCpf?: string;
    unitId: string;
    unitName: string;
    unitCode: string;
    slotPosition: number;
    profile: string;
    startDate: string;
    endDate: string | null;
    active: boolean;
};

export type MembershipSlotView = {
    slotPosition: 1 | 2 | 3;
    current: MembershipView | null;
    history: MembershipView[];
};

export type MembershipProfileView = {
    code: 'PROPRIETARIO' | 'LOCATARIO' | 'HOSPEDE' | 'ADMINISTRADOR' | 'SUPER';
    name: string;
    description: string;
};

export type UnitView = {
    id: string;
    name: string;
    code: string;
    floor: number | null;
    unitNumber: number | null;
    active: boolean;
    allowGuestReservations: boolean;
};

export type MachineType = 'WASHER' | 'DRYER';
export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

export type MachineRecord = {
    id: string;
    number: number;
    brand: string;
    model: string;
    name: string;
    type: MachineType;
    tuya_device_id: string | null;
    active: boolean;
    status: MachineStatus;
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
    tuyaDeviceId: string | null;
    active: boolean;
    status: MachineStatus;
};

export type MachineMaintenanceRecord = {
    id: string;
    machine_id: string;
    started_at: string;
    ended_at: string | null;
    problem: string;
    solution: string | null;
    created_by_user_id: string | null;
    closed_by_user_id: string | null;
    deleted_at: string | null;
    deleted_by_user_id: string | null;
    created_at: string;
    updated_at: string;
};

export type MachineMaintenanceView = {
    id: string;
    machineId: string;
    machineName: string;
    machineNumber: number;
    machineBrand: string;
    machineModel: string;
    machineType: MachineType;
    startedAt: string;
    endedAt: string | null;
    problem: string;
    solution: string | null;
    createdByUserId: string | null;
    createdByUserName: string | null;
    closedByUserId: string | null;
    closedByUserName: string | null;
    deletedAt: string | null;
    createdAt: string;
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
export type ReservationStartMode = 'ANY_TIME' | 'FULL_HOUR';

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
    canceled_reason: 'USER' | 'ADMIN' | 'MAINTENANCE' | null;
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
    canceledByUserId: string | null;
    canceledByUserName: string | null;
    canceledReason: 'USER' | 'ADMIN' | 'MAINTENANCE' | null;
};

export type ReservationBusyView = {
    id: string;
    machinePairId: string;
    startAt: string;
    endAt: string;
    status: ReservationStatus;
};

export type LaundrySessionStatus = 'ACTIVE' | 'FINISHED' | 'FORCED_FINISHED';

export type LaundrySessionRecord = {
    id: string;
    reservation_id: string;
    unit_id: string;
    machine_pair_id: string;
    user_id: string;
    checkin_at: string;
    started_at: string;
    finished_at: string | null;
    status: LaundrySessionStatus;
    overtime_started_at: string | null;
    overtime_ended_at: string | null;
    created_at: string;
    updated_at: string;
};

export type LaundrySessionView = {
    id: string;
    reservationId: string;
    reservationStartAt: string;
    reservationEndAt: string;
    unitId: string;
    unitName: string;
    unitCode: string;
    machinePairId: string;
    machinePairName: string;
    userId: string;
    userName: string;
    checkinAt: string;
    startedAt: string;
    finishedAt: string | null;
    status: LaundrySessionStatus;
    overtimeStartedAt: string | null;
    overtimeEndedAt: string | null;
};

export type ConsumptionSampleRecord = {
    id: string;
    laundry_session_id: string;
    machine_id: string;
    sample_at: string;
    power_watts: string;
    energy_kwh: string;
    created_at: string;
};

export type TuyaCommandLogRecord = {
    id: string;
    laundry_session_id: string | null;
    reservation_id: string | null;
    machine_id: string | null;
    device_id: string;
    command: string;
    success: boolean;
    request_payload: Record<string, unknown>;
    response_payload: Record<string, unknown>;
    error_message: string | null;
    created_at: string;
};

export type IncidentType = 'NO_SHOW' | 'OVERTIME' | 'FORCED_SHUTDOWN' | 'TUYA_ERROR';

export type IncidentRecord = {
    id: string;
    type: IncidentType;
    reservation_id: string | null;
    laundry_session_id: string | null;
    unit_id: string | null;
    user_id: string | null;
    description: string;
    metadata: Record<string, unknown>;
    created_at: string;
};

export type IncidentView = {
    id: string;
    type: IncidentType;
    reservationId: string | null;
    laundrySessionId: string | null;
    unitId: string | null;
    unitName: string | null;
    userId: string | null;
    userName: string | null;
    description: string;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export type SettingsVariableName =
    | 'CHECKIN_WINDOW_BEFORE_MINUTES'
    | 'CHECKIN_WINDOW_AFTER_MINUTES'
    | 'RESERVATION_DURATION_HOURS'
    | 'RESERVATION_START_MODE'
    | 'OVERTIME_THRESHOLD_WATTS'
    | 'CONSUMPTION_POLL_SECONDS'
    | 'BILLING_MODE'
    | 'PRICE_PER_USE'
    | 'PRICE_PER_KWH'
    | 'CHARGE_NO_SHOW'
    | 'CANCEL_DEADLINE_BEFORE_MINUTES';

export type SettingsVariableRecord = {
    id: string;
    variable: SettingsVariableName;
    value: string;
    start_at: string;
    end_at: string | null;
    updated_by_user_id: string | null;
    created_at: string;
};

export type SystemSettingsView = {
    checkinWindowBeforeMinutes: number;
    checkinWindowAfterMinutes: number;
    reservationDurationHours: number;
    reservationStartMode: ReservationStartMode;
    overtimeThresholdWatts: number;
    consumptionPollSeconds: number;
    billingMode: 'PER_USE' | 'PER_KWH';
    pricePerUse: number;
    pricePerKwh: number;
    chargeNoShow: boolean;
    cancelDeadlineBeforeMinutes: number;
    updatedByUserId: string | null;
    updatedAt: string;
};

export type InvoiceRecord = {
    id: string;
    competence: string;
    user_id: string;
    unit_id: string | null;
    billing_mode: 'PER_USE' | 'PER_KWH' | 'MIXED';
    total_amount: string;
    generated_at: string;
    created_at: string;
    updated_at: string;
};

export type InvoiceItemRecord = {
    id: string;
    invoice_id: string;
    reservation_id: string | null;
    laundry_session_id: string | null;
    charge_type: 'USE' | 'NO_SHOW';
    description: string;
    quantity: string;
    unit_price: string;
    total_amount: string;
    metadata: Record<string, unknown>;
    created_at: string;
};

export type InvoiceView = {
    id: string;
    competence: string;
    userId: string;
    userName: string;
    unitId: string | null;
    unitName: string | null;
    billingMode: 'PER_USE' | 'PER_KWH' | 'MIXED';
    totalAmount: number;
    generatedAt: string;
    createdAt: string;
};

export type InvoiceItemView = {
    id: string;
    invoiceId: string;
    reservationId: string | null;
    laundrySessionId: string | null;
    chargeType: 'USE' | 'NO_SHOW';
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    metadata: Record<string, unknown>;
    createdAt: string;
};
