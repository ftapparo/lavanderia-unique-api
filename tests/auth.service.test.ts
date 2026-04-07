import { authService } from '../src/services/auth.service';
import { usersRepository } from '../src/db/repositories/users.repository';
import { auditLogsRepository } from '../src/db/repositories/audit-logs.repository';
import { notificationEmailService } from '../src/services/notification-email.service';
import { hashPassword } from '../src/utils/password';

const baseUser = {
    id: 'user-1',
    name: 'User One',
    cpf: '12345678901',
    email: 'user@unique.local',
    phone: null,
    password_hash: hashPassword('old-password'),
    pin_hash: null as string | null,
    role: 'USER' as const,
    cargo: null,
    must_change_password: false,
    profile_photo: null,
    profile_photo_mime: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

describe('auth.service', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(auditLogsRepository, 'add').mockResolvedValue(undefined);
    });

    it('forgotPassword returns neutral success when user does not exist', async () => {
        jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue(null);
        const setPinSpy = jest.spyOn(usersRepository, 'setPin').mockResolvedValue(undefined);

        const result = await authService.forgotPassword({ identity: 'missing@unique.local' });

        expect(result).toEqual({ requested: true });
        expect(setPinSpy).not.toHaveBeenCalled();
    });

    it('forgotPassword sets pin and sends email when user exists', async () => {
        jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue({ ...baseUser });
        const setPinSpy = jest.spyOn(usersRepository, 'setPin').mockResolvedValue(undefined);
        const sendSpy = jest.spyOn(notificationEmailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);

        const result = await authService.forgotPassword({ identity: baseUser.email });

        expect(result).toEqual({ requested: true });
        expect(setPinSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWith({ name: baseUser.name, email: baseUser.email }, expect.any(String));
    });

    it('changePassword validates by pin when user has active pin', async () => {
        const pin = '123456';
        const userWithPin = {
            ...baseUser,
            pin_hash: hashPassword(pin),
        };

        jest.spyOn(usersRepository, 'findById').mockResolvedValue(userWithPin);
        const setPasswordSpy = jest.spyOn(usersRepository, 'setPasswordHash').mockResolvedValue(undefined);

        await authService.changePassword(userWithPin.id, {
            currentPassword: pin,
            newPassword: 'new-password-123',
        });

        expect(setPasswordSpy).toHaveBeenCalledTimes(1);
    });

    it('changePassword blocks invalid pin format when user has active pin', async () => {
        const userWithPin = {
            ...baseUser,
            pin_hash: hashPassword('123456'),
        };

        jest.spyOn(usersRepository, 'findById').mockResolvedValue(userWithPin);

        await expect(
            authService.changePassword(userWithPin.id, {
                currentPassword: 'abc123',
                newPassword: 'new-password-123',
            }),
        ).rejects.toMatchObject({
            status: 400,
            message: 'PIN invalido. Informe 6 digitos numericos.',
        });
    });

    it('resetPasswordByPin updates password when identity and pin are valid', async () => {
        const pin = '123456';
        const userWithPin = {
            ...baseUser,
            pin_hash: hashPassword(pin),
        };

        jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue(userWithPin);
        const setPasswordSpy = jest.spyOn(usersRepository, 'setPasswordHash').mockResolvedValue(undefined);

        const result = await authService.resetPasswordByPin({
            identity: userWithPin.email,
            pin,
            newPassword: 'new-password-123',
        });

        expect(result).toEqual({ changed: true });
        expect(setPasswordSpy).toHaveBeenCalledTimes(1);
    });

    it('resetPasswordByPin rejects invalid pin', async () => {
        const userWithPin = {
            ...baseUser,
            pin_hash: hashPassword('123456'),
        };
        jest.spyOn(usersRepository, 'findByEmail').mockResolvedValue(userWithPin);

        await expect(
            authService.resetPasswordByPin({
                identity: userWithPin.email,
                pin: '654321',
                newPassword: 'new-password-123',
            }),
        ).rejects.toMatchObject({
            status: 401,
            message: 'PIN invalido ou expirado.',
        });
    });
});
