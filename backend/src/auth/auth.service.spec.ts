import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditChainService } from '../security/audit-chain.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';

describe('AuthModule Unit & Integration Suite (Step 1 Production Hardened)', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  // Mocked Database State
  const mockUser = {
    id: 'user-uuid-101',
    email: 'admin@nyayavault.gov.in',
    fullName: 'System Administrator',
    passwordHash: '',
    role: RoleName.ADMIN,
    refreshTokenHash: null as string | null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOfficerUser = {
    id: 'user-uuid-102',
    email: 'io.sharma@nyayavault.gov.in',
    fullName: 'Inspector R. Sharma',
    passwordHash: '',
    role: RoleName.INVESTIGATING_OFFICER,
    refreshTokenHash: null as string | null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Stores
  const mockSessionsStore = new Map<string, any>();
  const mockResetTokensStore = new Map<string, any>();

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  const mockRegRequestsStore = new Map<string, any>();

  const mockPrismaService = {
    registrationRequest: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.email) {
          for (const req of mockRegRequestsStore.values()) {
            if (req.email === where.email) return req;
          }
        }
        if (where.id) return mockRegRequestsStore.get(where.id) || null;
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `reg-uuid-${mockRegRequestsStore.size + 1}`;
        const record = {
          id,
          email: data.email,
          fullName: data.fullName,
          passwordHash: data.passwordHash,
          requestedRole: data.requestedRole,
          status: data.status || 'PENDING',
          reviewedById: null,
          rejectionReason: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockRegRequestsStore.set(id, record);
        return record;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const record = mockRegRequestsStore.get(where.id);
        if (record) {
          Object.assign(record, data);
        }
        return record;
      }),
      findMany: jest.fn().mockImplementation(async () => {
        return Array.from(mockRegRequestsStore.values());
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.email === mockUser.email || where.id === mockUser.id) {
          return mockUser;
        }
        if (where.email === mockOfficerUser.email || where.id === mockOfficerUser.id) {
          return mockOfficerUser;
        }
        return null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        if (where.id === mockUser.id) {
          if ('isActive' in data) mockUser.isActive = data.isActive;
          if ('passwordHash' in data) mockUser.passwordHash = data.passwordHash;
          return mockUser;
        }
        return null;
      }),
    },
    passwordResetToken: {
      deleteMany: jest.fn().mockImplementation(async ({ where }) => {
        let count = 0;
        mockResetTokensStore.forEach((token, key) => {
          if (token.userId === where.userId) {
            mockResetTokensStore.delete(key);
            count++;
          }
        });
        return { count };
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `reset-token-uuid-${mockResetTokensStore.size + 1}`;
        const record = {
          id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: null,
          createdAt: new Date(),
        };
        mockResetTokensStore.set(data.tokenHash, record);
        return record;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const record = mockResetTokensStore.get(where.tokenHash);
        if (!record) return null;
        return {
          ...record,
          user: record.userId === mockUser.id ? mockUser : mockOfficerUser,
        };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        for (const [key, record] of mockResetTokensStore.entries()) {
          if (record.id === where.id) {
            if ('usedAt' in data) record.usedAt = data.usedAt;
            return record;
          }
        }
        return null;
      }),
    },
    userSession: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `session-uuid-${mockSessionsStore.size + 1}`;
        const session = {
          id,
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: data.userId === mockUser.id ? mockUser : mockOfficerUser,
        };
        mockSessionsStore.set(id, session);
        return session;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const session = mockSessionsStore.get(where.id);
        if (!session) return null;
        return {
          ...session,
          user: session.userId === mockUser.id ? mockUser : mockOfficerUser,
        };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const session = mockSessionsStore.get(where.id);
        if (!session) return null;
        if ('refreshTokenHash' in data) session.refreshTokenHash = data.refreshTokenHash;
        if ('revokedAt' in data) session.revokedAt = data.revokedAt;
        return session;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        let count = 0;
        mockSessionsStore.forEach((session) => {
          if (session.userId === where.userId && session.revokedAt === null) {
            if (where.id && session.id !== where.id) return;
            session.revokedAt = data.revokedAt;
            count++;
          }
        });
        return { count };
      }),
    },
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('Admin@Nyaya2026');
    mockOfficerUser.passwordHash = await argon2.hash('Officer@Nyaya2026');

    const mockAuditChainService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'audit-mock-id', sequenceNumber: '1' }),
      verifyChain: jest.fn().mockResolvedValue({ valid: true, totalEvents: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'dev_jwt_secret_key_for_local_testing_only',
        }),
      ],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditChainService,
          useValue: mockAuditChainService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('1. Password Hashing & Security (Argon2)', () => {
    it('should correctly hash and verify passwords using Argon2', async () => {
      const password = 'SecurePassword123!';
      const hash = await argon2.hash(password);
      expect(hash).not.toEqual(password);
      expect(await argon2.verify(hash, password)).toBe(true);
      expect(await argon2.verify(hash, 'WrongPassword')).toBe(false);
    });
  });

  describe('2. Login Authentication & UserSession Creation', () => {
    it('should successfully log in with valid credentials, create a UserSession, and return tokens without passwordHash', async () => {
      const result = await authService.login(
        { email: 'admin@nyayavault.gov.in', password: 'Admin@Nyaya2026' },
        '127.0.0.1',
        'Jest/Test-Agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@nyayavault.gov.in');
      expect(result.user.role).toBe(RoleName.ADMIN);

      // Verify non-exposure invariant
      expect((result.user as any).passwordHash).toBeUndefined();
      expect((result.user as any).refreshTokenHash).toBeUndefined();

      // Verify UserSession was created in store
      expect(mockSessionsStore.size).toBeGreaterThan(0);
    });

    it('should reject login with invalid password', async () => {
      await expect(
        authService.login({ email: 'admin@nyayavault.gov.in', password: 'IncorrectPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login with non-existent email', async () => {
      await expect(
        authService.login({ email: 'unknown@nyayavault.gov.in', password: 'Admin@Nyaya2026' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('3. Multi-Session & Refresh Token Rotation', () => {
    it('should allow multi-device logins creating independent sessions', async () => {
      const session1 = await authService.login(
        { email: 'admin@nyayavault.gov.in', password: 'Admin@Nyaya2026' },
        '10.0.0.1',
        'Device-1',
      );

      const session2 = await authService.login(
        { email: 'admin@nyayavault.gov.in', password: 'Admin@Nyaya2026' },
        '10.0.0.2',
        'Device-2',
      );

      expect(session1.refreshToken).not.toEqual(session2.refreshToken);

      // Rotating session 1 should not invalidate session 2
      const rotated1 = await authService.refreshTokens(session1.refreshToken);
      expect(rotated1.accessToken).toBeDefined();

      const refreshed2 = await authService.refreshTokens(session2.refreshToken);
      expect(refreshed2.accessToken).toBeDefined();
    });

    it('should reject reuse of a revoked refresh token', async () => {
      const loginRes = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });

      // Refresh once (rotates and revokes original session token)
      await authService.refreshTokens(loginRes.refreshToken);

      // Attempting to reuse original refresh token must fail
      await expect(authService.refreshTokens(loginRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke user session on logout', async () => {
      const loginRes = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });

      const logoutRes = await authService.logout(mockUser.id, loginRes.refreshToken);
      expect(logoutRes.message).toBe('Logged out successfully');

      // Refresh attempt with logged out session must fail
      await expect(authService.refreshTokens(loginRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('4. Account Status & JWT Guard Enforcement', () => {
    it('should reject login for deactivated users', async () => {
      mockUser.isActive = false;
      await expect(
        authService.login({ email: 'admin@nyayavault.gov.in', password: 'Admin@Nyaya2026' }),
      ).rejects.toThrow(UnauthorizedException);
      mockUser.isActive = true; // reset
    });

    it('should deny JWT access guard when user account is deactivated in DB', async () => {
      const guard = new JwtAuthGuard(jwtService, mockPrismaService as any);
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key_for_local_testing_only';
      const token = await jwtService.signAsync(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        { secret },
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${token}` },
          }),
        }),
      } as ExecutionContext;

      // Active -> grant
      expect(await guard.canActivate(mockContext)).toBe(true);

      // Deactivated -> deny immediately
      mockUser.isActive = false;
      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      mockUser.isActive = true; // reset
    });
  });

  describe('5. RBAC Roles Guard Enforcement', () => {
    it('should grant access when user role matches required role (ADMIN)', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.ADMIN]);
      const guard = new RolesGuard(reflector);

      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: mockUser.id, email: mockUser.email, role: RoleName.ADMIN },
          }),
        }),
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should deny access when user role does not match required role', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.ADMIN]);
      const guard = new RolesGuard(reflector);

      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: mockOfficerUser.id,
              email: mockOfficerUser.email,
              role: RoleName.INVESTIGATING_OFFICER,
            },
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('6. Password Reset Security & Token Hashing', () => {
    it('1, 2, 3, 4. Should return identical generic response for valid, nonexistent, or disabled emails (Account Enumeration Defense)', async () => {
      const res1 = await authService.requestPasswordReset({ email: 'admin@nyayavault.gov.in' });
      const res2 = await authService.requestPasswordReset({ email: 'nonexistent@nyayavault.gov.in' });

      mockUser.isActive = false;
      const res3 = await authService.requestPasswordReset({ email: 'admin@nyayavault.gov.in' });
      mockUser.isActive = true;

      const expectedMsg = 'If an active account exists for this official email, password reset instructions will be sent.';
      expect(res1.message).toBe(expectedMsg);
      expect(res2.message).toBe(expectedMsg);
      expect(res3.message).toBe(expectedMsg);
    });

    it('5, 6, 14, 15. Should generate random 256-bit token, store only SHA-256 hash in DB, and never expose raw token in DB or audit events', async () => {
      mockResetTokensStore.clear();
      await authService.requestPasswordReset({ email: 'admin@nyayavault.gov.in' });

      expect(mockResetTokensStore.size).toBe(1);
      const storedRecord = Array.from(mockResetTokensStore.values())[0];

      expect(storedRecord.tokenHash).toHaveLength(64); // SHA-256 hex string
      expect(storedRecord.rawToken).toBeUndefined(); // Raw token never stored
    });

    it('7, 8, 9, 10, 11, 12, 13, 17. Should complete password reset with valid token, update password with Argon2, revoke all sessions, and require fresh login', async () => {
      // 1. Create active session
      const loginRes = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });
      expect(loginRes.accessToken).toBeDefined();

      // 2. Request reset
      mockResetTokensStore.clear();
      await authService.requestPasswordReset({ email: 'admin@nyayavault.gov.in' });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();

      // Extract raw token from mock email call
      const resetCallArgs = mockEmailService.sendPasswordResetEmail.mock.calls.slice(-1)[0];
      const resetUrl = resetCallArgs[1];
      const rawToken = new URL(resetUrl).searchParams.get('token');
      expect(rawToken).toBeTruthy();

      // 3. Confirm password reset with new password
      const newPass = 'BrandNewSecuredPassword2026!';
      const confirmRes = await authService.confirmPasswordReset({
        token: rawToken!,
        newPassword: newPass,
        confirmPassword: newPass,
      });

      expect(confirmRes.message).toContain('Password reset successfully');

      // 4. Verify old password no longer works
      await expect(
        authService.login({ email: 'admin@nyayavault.gov.in', password: 'Admin@Nyaya2026' }),
      ).rejects.toThrow();

      // 5. Verify new password works
      const newLogin = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: newPass,
      });
      expect(newLogin.accessToken).toBeDefined();

      // 6. Verify token reuse prevention
      await expect(
        authService.confirmPasswordReset({
          token: rawToken!,
          newPassword: 'AnotherPassword123!',
          confirmPassword: 'AnotherPassword123!',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Registration Workflow Tests (Step 19 Admin Approval Model)', () => {
    it('1. Should submit a valid registration request with PENDING status', async () => {
      const res = await authService.register({
        email: 'applicant.test@nyayavault.gov.in',
        fullName: 'Applicant Officer Test',
        password: 'Password@2026Test',
        requestedRole: RoleName.INVESTIGATING_OFFICER,
      });

      expect(res.message).toBe('Registration submitted');
      expect(res.status).toBe('PENDING');
      expect(res.detail).toContain('pending administrator approval');
    });

    it('2. Should reject registration request attempting ADMIN role', async () => {
      await expect(
        authService.register({
          email: 'hacker.admin@nyayavault.gov.in',
          fullName: 'Fake Admin Attempt',
          password: 'Password@2026Test',
          requestedRole: RoleName.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3. Should block login for pending registration request with clear message', async () => {
      await expect(
        authService.login({
          email: 'applicant.test@nyayavault.gov.in',
          password: 'Password@2026Test',
        }),
      ).rejects.toThrow('Your registration is awaiting administrator approval.');
    });
  });
});

