import { db } from '../db/pool';
import { membershipsRepository } from '../db/repositories/memberships.repository';
import { unitsRepository } from '../db/repositories/units.repository';
import { usersRepository } from '../db/repositories/users.repository';
import { auditLogsRepository } from '../db/repositories/audit-logs.repository';
import type { MembershipSlotView, MembershipView } from '../types/domain.types';
import { AppError } from '../utils/app-error';

const MEMBERSHIP_PROFILES = ['PROPRIETARIO', 'LOCATARIO', 'HOSPEDE', 'ADMINISTRADOR', 'SUPER'] as const;
type MembershipProfile = typeof MEMBERSHIP_PROFILES[number];

type SlotPosition = 1 | 2 | 3;

type SlotWriteInput = {
    slotPosition: number;
    userId: string | null;
    profile: string | null;
    startDate: string | null;
    endDate?: string | null;
    active?: boolean;
};

const toIsoDate = (input: Date): string => input.toISOString().slice(0, 10);

const normalizeDate = (value: string): string => {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new AppError('Data invalida. Use formato YYYY-MM-DD.', 400);
    }
    return trimmed;
};

const validateDateRange = (startDate: string, endDate?: string | null): void => {
    if (!startDate) {
        throw new AppError('Data de inicio obrigatoria.', 400);
    }

    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = endDate ? normalizeDate(endDate) : null;

    if (normalizedEnd && new Date(`${normalizedEnd}T00:00:00Z`) < new Date(`${normalizedStart}T00:00:00Z`)) {
        throw new AppError('Data final deve ser maior ou igual a data inicial.', 400);
    }
};

const normalizeProfile = (inputProfile: string): MembershipProfile => {
    const profile = inputProfile.trim().toUpperCase();
    if (!profile) {
        throw new AppError('Perfil de vinculo obrigatorio.', 400);
    }
    if (!MEMBERSHIP_PROFILES.includes(profile as MembershipProfile)) {
        throw new AppError('Perfil de vinculo invalido.', 400, { allowed: MEMBERSHIP_PROFILES });
    }
    return profile as MembershipProfile;
};

const normalizeSlotPosition = (input: number): SlotPosition => {
    const value = Number(input);
    if (!Number.isInteger(value) || value < 1 || value > 3) {
        throw new AppError('Posicao de vinculo invalida. Informe valor entre 1 e 3.', 400);
    }

    return value as SlotPosition;
};

const isMembershipActiveOnDate = (membership: Pick<MembershipView, 'active' | 'startDate' | 'endDate'>, dateIso: string): boolean => {
    if (!membership.active) return false;
    if (membership.startDate > dateIso) return false;
    if (membership.endDate && membership.endDate < dateIso) return false;
    return true;
};

const minusOneDay = (isoDate: string): string => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 1);
    return toIsoDate(date);
};

const mapSlots = (memberships: MembershipView[]): MembershipSlotView[] => {
    const today = toIsoDate(new Date());

    return [1, 2, 3].map((slotPosition) => {
        const slotMemberships = memberships.filter((item) => item.slotPosition === slotPosition);
        const current = slotMemberships.find((item) => isMembershipActiveOnDate(item, today)) || null;
        return {
            slotPosition: slotPosition as SlotPosition,
            current,
            history: slotMemberships.slice(0, 10),
        };
    });
};

const isSlotEmpty = (slot: {
    userId: string | null;
    profile: MembershipProfile | null;
    startDate: string | null;
    active: boolean;
}): boolean => !slot.userId || !slot.profile || !slot.startDate || slot.active === false;

const ensureSlotOneOwner = async (unitId: string, dateIso: string): Promise<void> => {
    const slotOne = await membershipsRepository.findCurrentByUnitAndSlotOnDate({
        unitId,
        slotPosition: 1,
        dateIso,
    });

    if (!slotOne || slotOne.profile !== 'PROPRIETARIO') {
        throw new AppError('A unidade precisa ter titular proprietario no vinculo 1.', 400);
    }
};

const mapPgMembershipConstraintError = (error: unknown): never => {
    const pgError = error as { code?: string; detail?: string };

    if (pgError?.code === '23P01') {
        throw new AppError('Ja existe vinculo ativo sobreposto para esta posicao.', 409);
    }

    throw error;
};

export const membershipsService = {
    async listProfiles() {
        return membershipsRepository.listProfiles();
    },

    async listUnitSlots(unitId: string): Promise<MembershipSlotView[]> {
        const unit = await unitsRepository.findById(unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const memberships = await membershipsRepository.listByUnitId(unitId);
        return mapSlots(memberships);
    },

    async saveUnitSlots(unitId: string, slots: SlotWriteInput[], actorUserId: string): Promise<MembershipSlotView[]> {
        const unit = await unitsRepository.findById(unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        if (!Array.isArray(slots) || slots.length !== 3) {
            throw new AppError('Envie os 3 vinculos da unidade (posicoes 1, 2 e 3).', 400);
        }

        const normalizedSlots = slots.map((slot) => ({
            slotPosition: normalizeSlotPosition(slot.slotPosition),
            userId: slot.userId ? String(slot.userId).trim() : null,
            profile: slot.profile ? normalizeProfile(String(slot.profile)) : null,
            startDate: slot.startDate ? normalizeDate(String(slot.startDate)) : null,
            endDate: slot.endDate ? normalizeDate(String(slot.endDate)) : null,
            active: typeof slot.active === 'boolean' ? slot.active : true,
        }));

        const dedupe = new Set<number>();
        for (const slot of normalizedSlots) {
            if (dedupe.has(slot.slotPosition)) {
                throw new AppError('Nao e permitido repetir posicoes de vinculo.', 400);
            }
            dedupe.add(slot.slotPosition);
        }

        for (const requiredPosition of [1, 2, 3]) {
            if (!dedupe.has(requiredPosition)) {
                throw new AppError('As posicoes 1, 2 e 3 devem ser enviadas.', 400);
            }
        }

        const slot1 = normalizedSlots.find((item) => item.slotPosition === 1);
        if (!slot1 || !slot1.userId || slot1.profile !== 'PROPRIETARIO' || !slot1.startDate) {
            throw new AppError('A posicao 1 e obrigatoria e deve ser PROPRIETARIO.', 400);
        }

        const duplicateUsers = normalizedSlots
            .filter((slot) => slot.userId && slot.active !== false)
            .map((slot) => String(slot.userId));
        if (new Set(duplicateUsers).size !== duplicateUsers.length) {
            throw new AppError('Nao e permitido vincular o mesmo usuario em mais de um slot ativo da unidade.', 409);
        }

        const slot3 = normalizedSlots.find((item) => item.slotPosition === 3);
        if (slot3?.profile === 'ADMINISTRADOR') {
            throw new AppError('A posicao 3 nao aceita perfil ADMINISTRADOR.', 400);
        }

        const today = toIsoDate(new Date());
        const currentSlot1 = await membershipsRepository.findCurrentByUnitAndSlotOnDate({
            unitId,
            slotPosition: 1,
            dateIso: today,
        });

        if (currentSlot1 && slot1.userId !== currentSlot1.user_id) {
            const slot2Input = normalizedSlots.find((item) => item.slotPosition === 2);
            const slot3Input = normalizedSlots.find((item) => item.slotPosition === 3);
            if (!slot2Input || !slot3Input || !isSlotEmpty(slot2Input) || !isSlotEmpty(slot3Input)) {
                throw new AppError('Para trocar o titular da posicao 1, as posicoes 2 e 3 devem estar vazias.', 409);
            }
        }

        const currentSlot2 = await membershipsRepository.findCurrentByUnitAndSlotOnDate({
            unitId,
            slotPosition: 2,
            dateIso: today,
        });
        const slot2Input = normalizedSlots.find((item) => item.slotPosition === 2);
        if (
            currentSlot2?.profile === 'ADMINISTRADOR'
            && slot2Input
            && isSlotEmpty(slot2Input)
            && slot3
            && !isSlotEmpty(slot3)
        ) {
            throw new AppError('Para remover ADMINISTRADOR da posicao 2, a posicao 3 deve estar vazia.', 409);
        }

        for (const slot of normalizedSlots) {
            if (!slot.userId) {
                continue;
            }
            const slotUserId = slot.userId;

            if (!slot.profile) {
                throw new AppError(`Perfil obrigatorio na posicao ${slot.slotPosition}.`, 400);
            }
            if (!slot.startDate) {
                throw new AppError(`Data de inicio obrigatoria na posicao ${slot.slotPosition}.`, 400);
            }
            const slotStartDate = slot.startDate;
            const slotProfile = slot.profile;

            validateDateRange(slotStartDate, slot.endDate);
            if (slot.slotPosition === 1 && slotProfile !== 'PROPRIETARIO') {
                throw new AppError('A posicao 1 aceita somente perfil PROPRIETARIO.', 400);
            }
            if (slotProfile === 'HOSPEDE' && !slot.endDate) {
                throw new AppError('Perfil HOSPEDE exige data final.', 400);
            }

            const user = await usersRepository.findById(slotUserId);
            if (!user) {
                throw new AppError(`Usuario nao encontrado para a posicao ${slot.slotPosition}.`, 404);
            }

            const profileExists = await membershipsRepository.profileExists(slotProfile);
            if (!profileExists) {
                throw new AppError('Perfil de vinculo nao cadastrado.', 400);
            }

            if (slotProfile === 'LOCATARIO') {
                const hasConflict = await membershipsRepository.hasOverlappingLocatarioForUser({
                    userId: slotUserId,
                    unitId,
                    startDate: slotStartDate,
                    endDate: slot.endDate,
                });
                if (hasConflict) {
                    throw new AppError('Locatario pode ocupar apenas uma unidade por periodo.', 409);
                }
            }
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            for (const slot of normalizedSlots.sort((a, b) => a.slotPosition - b.slotPosition)) {
            const current = await membershipsRepository.findCurrentByUnitAndSlotOnDate({
                    unitId,
                    slotPosition: slot.slotPosition,
                    dateIso: today,
                }, client);

                if (!slot.userId || !slot.profile || !slot.startDate || slot.active === false) {
                    if (current) {
                        await membershipsRepository.closeActiveByUnitAndSlot({
                            unitId,
                            slotPosition: slot.slotPosition,
                            closeDate: toIsoDate(new Date()),
                        }, client);
                    }
                    continue;
                }

                if (current
                    && current.user_id === slot.userId
                    && current.profile === slot.profile
                    && current.start_date === slot.startDate
                    && (current.end_date || null) === (slot.endDate || null)
                    && current.active) {
                    continue;
                }

                if (current) {
                    if (slot.startDate <= current.start_date) {
                        throw new AppError(
                            `A data de inicio da posicao ${slot.slotPosition} deve ser posterior ao vinculo atual.`,
                            409,
                        );
                    }

                    await membershipsRepository.closeActiveByUnitAndSlot({
                        unitId,
                        slotPosition: slot.slotPosition,
                        closeDate: minusOneDay(slot.startDate),
                    }, client);
                }

                const hasOverlappingSlot = await membershipsRepository.hasOverlappingMembershipOnSlot({
                    unitId,
                    slotPosition: slot.slotPosition,
                    startDate: slot.startDate,
                    endDate: slot.endDate,
                }, client);
                if (hasOverlappingSlot) {
                    throw new AppError(`Ja existe vinculo sobreposto na posicao ${slot.slotPosition}.`, 409);
                }

                await membershipsRepository.create({
                    userId: slot.userId,
                    unitId,
                    slotPosition: slot.slotPosition,
                    profile: slot.profile,
                    startDate: slot.startDate,
                    endDate: slot.endDate,
                    active: true,
                }, client);
            }

            await ensureSlotOneOwner(unitId, today);

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            mapPgMembershipConstraintError(error);
        } finally {
            client.release();
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_MEMBERSHIP_SLOTS_SAVED',
            entity: 'unit_memberships',
            entityId: unitId,
            payload: {
                unitId,
                slots: normalizedSlots,
            },
        });

        return membershipsService.listUnitSlots(unitId);
    },

    async create(input: {
        userId: string;
        unitId: string;
        slotPosition?: number;
        profile: string;
        startDate: string;
        endDate?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        validateDateRange(input.startDate, input.endDate);

        const user = await usersRepository.findById(input.userId);
        if (!user) {
            throw new AppError('Usuario nao encontrado.', 404);
        }

        const unit = await unitsRepository.findById(input.unitId);
        if (!unit) {
            throw new AppError('Unidade nao encontrada.', 404);
        }

        const profile = normalizeProfile(input.profile);
        const profileExists = await membershipsRepository.profileExists(profile);
        if (!profileExists) {
            throw new AppError('Perfil de vinculo nao cadastrado.', 400);
        }

        if (profile === 'HOSPEDE' && !input.endDate) {
            throw new AppError('Perfil HOSPEDE exige data final.', 400);
        }

        const today = toIsoDate(new Date());
        const activeMemberships = (await membershipsRepository.listByUnitId(input.unitId))
            .filter((item) => isMembershipActiveOnDate(item, today));

        let slotPosition: SlotPosition;
        if (typeof input.slotPosition === 'number') {
            slotPosition = normalizeSlotPosition(input.slotPosition);
        } else {
            const occupied = new Set(activeMemberships.map((item) => item.slotPosition));
            if (profile === 'PROPRIETARIO' && !occupied.has(1)) {
                slotPosition = 1;
            } else if (!occupied.has(2)) {
                slotPosition = 2;
            } else if (!occupied.has(3)) {
                slotPosition = 3;
            } else {
                throw new AppError('A unidade ja possui o maximo de 3 vinculos ativos.', 409);
            }
        }

        if (slotPosition === 1 && profile !== 'PROPRIETARIO') {
            throw new AppError('A posicao 1 aceita somente perfil PROPRIETARIO.', 400);
        }

        if (slotPosition !== 1) {
            const hasOwner = activeMemberships.some((item) => item.slotPosition === 1 && item.profile === 'PROPRIETARIO');
            if (!hasOwner) {
                throw new AppError('Para vincular nas posicoes 2 e 3, a unidade precisa de titular proprietario na posicao 1.', 400);
            }
        }

        if (profile === 'LOCATARIO') {
            const hasConflict = await membershipsRepository.hasOverlappingLocatarioForUser({
                userId: input.userId,
                unitId: input.unitId,
                startDate: input.startDate,
                endDate: input.endDate,
            });
            if (hasConflict) {
                throw new AppError('Locatario pode ocupar apenas uma unidade por periodo.', 409);
            }
        }

        const hasOverlappingSlot = await membershipsRepository.hasOverlappingMembershipOnSlot({
            unitId: input.unitId,
            slotPosition,
            startDate: input.startDate,
            endDate: input.endDate,
        });
        if (hasOverlappingSlot) {
            throw new AppError('Ja existe vinculo ativo sobreposto para esta posicao.', 409);
        }

        let membership: Awaited<ReturnType<typeof membershipsRepository.create>> | null = null;
        try {
            membership = await membershipsRepository.create({
                userId: input.userId,
                unitId: input.unitId,
                slotPosition,
                profile,
                startDate: input.startDate,
                endDate: input.endDate,
                active: input.active ?? true,
            });
        } catch (error) {
            mapPgMembershipConstraintError(error);
        }
        if (!membership) {
            throw new AppError('Falha ao criar vinculo.', 500);
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_MEMBERSHIP_CREATED',
            entity: 'unit_memberships',
            entityId: membership.id,
            payload: {
                userId: membership.user_id,
                unitId: membership.unit_id,
                slotPosition: membership.slot_position,
                profile: membership.profile,
                startDate: membership.start_date,
                endDate: membership.end_date,
            },
        });

        return membership;
    },

    async update(id: string, input: {
        slotPosition?: number;
        profile?: string;
        startDate?: string;
        endDate?: string | null;
        active?: boolean;
    }, actorUserId: string) {
        const existing = await membershipsRepository.findById(id);
        if (!existing) {
            throw new AppError('Vinculo nao encontrado.', 404);
        }

        const nextStartDate = input.startDate ?? existing.start_date;
        const nextEndDate = input.endDate ?? existing.end_date;
        const nextProfile = input.profile ? normalizeProfile(input.profile) : (existing.profile as MembershipProfile);
        const nextSlot = typeof input.slotPosition === 'number' ? normalizeSlotPosition(input.slotPosition) : normalizeSlotPosition(existing.slot_position);

        validateDateRange(nextStartDate, nextEndDate);

        if (nextSlot === 1 && nextProfile !== 'PROPRIETARIO') {
            throw new AppError('A posicao 1 aceita somente perfil PROPRIETARIO.', 400);
        }

        if (nextProfile === 'HOSPEDE' && !nextEndDate) {
            throw new AppError('Perfil HOSPEDE exige data final.', 400);
        }

        if (nextProfile === 'LOCATARIO') {
            const hasConflict = await membershipsRepository.hasOverlappingLocatarioForUser({
                userId: existing.user_id,
                unitId: existing.unit_id,
                startDate: nextStartDate,
                endDate: nextEndDate,
                excludeMembershipId: existing.id,
            });
            if (hasConflict) {
                throw new AppError('Locatario pode ocupar apenas uma unidade por periodo.', 409);
            }
        }

        const hasOverlappingSlot = await membershipsRepository.hasOverlappingMembershipOnSlot({
            unitId: existing.unit_id,
            slotPosition: nextSlot,
            startDate: nextStartDate,
            endDate: nextEndDate,
            excludeMembershipId: existing.id,
        });
        if (hasOverlappingSlot) {
            throw new AppError('Ja existe vinculo ativo sobreposto para esta posicao.', 409);
        }

        const updated = await membershipsRepository.update(id, {
            ...input,
            slotPosition: nextSlot,
            profile: nextProfile,
        });
        if (!updated) {
            throw new AppError('Falha ao atualizar vinculo.', 500);
        }

        if (updated.slot_position === 1 && updated.profile !== 'PROPRIETARIO') {
            throw new AppError('A posicao 1 deve manter perfil PROPRIETARIO.', 400);
        }

        await auditLogsRepository.add({
            actorUserId,
            action: 'UNIT_MEMBERSHIP_UPDATED',
            entity: 'unit_memberships',
            entityId: id,
            payload: {
                ...input,
                slotPosition: nextSlot,
                profile: nextProfile,
            } as Record<string, unknown>,
        });

        return updated;
    },

    async list(userId: string, isAdmin: boolean) {
        if (isAdmin) {
            return membershipsRepository.listAll();
        }

        return membershipsRepository.listByUserId(userId);
    },
};
