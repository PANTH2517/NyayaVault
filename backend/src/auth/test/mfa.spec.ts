import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException, BadRequestException, ExecutionContext } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';
import { MfaService } from '../mfa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditChainService } from '../../security/audit-chain.service';
import { EmailService } from '../../email/email.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RoleName } from '@prisma/client';

describe('Sub-Phase 1I — Real TOTP MFA & Advanced Authentication Suite', () => {
  let authService: AuthService;
  let mfaService: MfaService;
  let jwtService: JwtService;

  // Key for testing encryption
  const TEST_MFA_KEY = '12345678901234567890123456789012'; // 32 bytes

  // Mock User State
  const mockStandardUser = {
    id: 'user-mfa-disabled-01',
    email: 'user.standard@nyayavault.gov.in',
    fullName: 'Standard User (No MFA)',
    passwordHash: '',
    role: RoleName.INVESTIGATING_OFFICER,
    refreshTokenHash: null as string | null,
    isActive: true,
    mfaEnabled: false,
    mfaSecretEncrypted: null as string | null,
    mfaEnrolledAt: null as Date | null,
    mfaLastUsedTimeStep: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMfaUser = {
    id: 'user-mfa-enabled-02',
    email: 'user.mfa@nyayavault.gov.in',
    fullName: 'MFA Protected Officer',
    passwordHash: '',
    role: RoleName.INVESTIGATING_OFFICER,
    refreshTokenHash: null as string | null,
    isActive: true,
    mfaEnabled: true,
    mfaSecretEncrypted: null as string | null,
    mfaEnrolledAt: new Date(),
    mfaLastUsedTimeStep: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    id: 'admin-mfa-03',
    email: 'admin.mfa@nyayavault.gov.in',
    fullName: 'System Admin',
    passwordHash: '',
    role: RoleName.ADMIN,
    refreshTokenHash: null as string | null,
    isActive: true,
    mfaEnabled: true,
    mfaSecretEncrypted: null as string | null,
    mfaEnrolledAt: new Date(),
    mfaLastUsedTimeStep: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Stores
  const mockSessionsStore = new Map<string, any>();
  const mockRecoveryCodesStore = new Map<string, any[]>();

  const mockAuditChainService = {
    recordEvent: jest.fn().mockResolvedValue({ id: 'audit-mock-id', sequenceNumber: '1' }),
    verifyChain: jest.fn().mockResolvedValue({ valid: true, totalEvents: 1 }),
  };

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  const mockResetTokensStore = new Map<string, any>();

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockPrismaService)),
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === mockStandardUser.id || where.email === mockStandardUser.email) return mockStandardUser;
        if (where.id === mockMfaUser.id || where.email === mockMfaUser.email) return mockMfaUser;
        if (where.id === mockAdminUser.id || where.email === mockAdminUser.email) return mockAdminUser;
        return null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const u = [mockStandardUser, mockMfaUser, mockAdminUser].find((x) => x.id === where.id);
        if (u) {
          Object.assign(u, data);
          return u;
        }
        return null;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        let count = 0;
        const u = [mockStandardUser, mockMfaUser, mockAdminUser].find((x) => x.id === where.id);
        if (u) {
          if (where.OR) {
            const matchesNull = where.OR.some((cond: any) => cond.mfaLastUsedTimeStep === null && u.mfaLastUsedTimeStep === null);
            const matchesLt = where.OR.some((cond: any) => cond.mfaLastUsedTimeStep?.lt !== undefined && u.mfaLastUsedTimeStep !== null && u.mfaLastUsedTimeStep < cond.mfaLastUsedTimeStep.lt);
            if (matchesNull || matchesLt) {
              Object.assign(u, data);
              count = 1;
            }
          } else {
            Object.assign(u, data);
            count = 1;
          }
        }
        return { count };
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
          user: record.userId === mockStandardUser.id ? mockStandardUser : mockAdminUser,
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
    mfaRecoveryCode: {
      findMany: jest.fn().mockImplementation(async ({ where }) => {
        const codes = mockRecoveryCodesStore.get(where.userId) || [];
        if (where.usedAt === null) {
          return codes.filter((c) => c.usedAt === null);
        }
        return codes;
      }),
      count: jest.fn().mockImplementation(async ({ where }) => {
        const codes = mockRecoveryCodesStore.get(where.userId) || [];
        if (where.usedAt === null) {
          return codes.filter((c) => c.usedAt === null).length;
        }
        return codes.length;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        for (const list of mockRecoveryCodesStore.values()) {
          const item = list.find((c) => c.id === where.id);
          if (item) {
            Object.assign(item, data);
            return item;
          }
        }
        return null;
      }),
      deleteMany: jest.fn().mockImplementation(async ({ where }) => {
        let count = 0;
        if (where.userId) {
          count = (mockRecoveryCodesStore.get(where.userId) || []).length;
          mockRecoveryCodesStore.delete(where.userId);
        }
        return { count };
      }),
      createMany: jest.fn().mockImplementation(async ({ data }) => {
        const items = data.map((d: any, idx: number) => ({
          id: `rc-uuid-${Date.now()}-${idx}`,
          userId: d.userId,
          codeHash: d.codeHash,
          usedAt: null,
          createdAt: new Date(),
        }));
        const existing = mockRecoveryCodesStore.get(data[0].userId) || [];
        mockRecoveryCodesStore.set(data[0].userId, [...existing, ...items]);
        return { count: items.length };
      }),
    },
    userSession: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `session-${mockSessionsStore.size + 1}`;
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
        };
        mockSessionsStore.set(id, session);
        return session;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const session = mockSessionsStore.get(where.id);
        if (session) {
          Object.assign(session, data);
        }
        return session;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        let count = 0;
        mockSessionsStore.forEach((session) => {
          if (session.userId === where.userId && session.revokedAt === null) {
            session.revokedAt = data.revokedAt;
            count++;
          }
        });
        return { count };
      }),
    },
    registrationRequest: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = TEST_MFA_KEY;
    process.env.MFA_CHALLENGE_SECRET = 'test_mfa_challenge_secret_key_32bytes_long';

    mockStandardUser.passwordHash = await argon2.hash('StandardPass123!');
    mockMfaUser.passwordHash = await argon2.hash('MfaPass123!');
    mockAdminUser.passwordHash = await argon2.hash('AdminPass123!');

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'dev_jwt_secret_key_for_local_testing_only',
        }),
      ],
      providers: [
        AuthService,
        MfaService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditChainService, useValue: mockAuditChainService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    mfaService = module.get<MfaService>(MfaService);
    jwtService = module.get<JwtService>(JwtService);

    // Setup encrypted TOTP secret for mockMfaUser & mockAdminUser
    const secret = mfaService.generateTotpSecret();
    mockMfaUser.mfaSecretEncrypted = mfaService.encryptSecret(secret);
    mockAdminUser.mfaSecretEncrypted = mfaService.encryptSecret(secret);
  });

  describe('1. Authentication Invariants with MFA', () => {
    it('1. MFA-disabled user can login normally and receive tokens', async () => {
      const res = await authService.login({ email: mockStandardUser.email, password: 'StandardPass123!' });
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.mfaRequired).toBeUndefined();
    });

    it('2. MFA-enabled user with correct password receives mfaChallengeToken', async () => {
      const res = await authService.login({ email: mockMfaUser.email, password: 'MfaPass123!' });
      expect(res.mfaRequired).toBe(true);
      expect(res.mfaChallengeToken).toBeDefined();
      expect(res.expiresIn).toBe(300);
    });

    it('3. MFA-enabled password login does not issue access token', async () => {
      const res = await authService.login({ email: mockMfaUser.email, password: 'MfaPass123!' });
      expect(res.accessToken).toBeUndefined();
    });

    it('4. MFA-enabled password login does not issue refresh token', async () => {
      const res = await authService.login({ email: mockMfaUser.email, password: 'MfaPass123!' });
      expect(res.refreshToken).toBeUndefined();
    });

    it('5. MFA-enabled password login does not create UserSession', async () => {
      const sessionCountBefore = mockSessionsStore.size;
      await authService.login({ email: mockMfaUser.email, password: 'MfaPass123!' });
      expect(mockSessionsStore.size).toBe(sessionCountBefore);
    });

    it('6. Invalid password for MFA-enabled user returns 401', async () => {
      await expect(
        authService.login({ email: mockMfaUser.email, password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('7. Invalid password response does not reveal MFA status', async () => {
      try {
        await authService.login({ email: mockMfaUser.email, password: 'WrongPassword' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
      }
    });

    it('8. Disabled user cannot receive MFA challenge', async () => {
      mockMfaUser.isActive = false;
      await expect(
        authService.login({ email: mockMfaUser.email, password: 'MfaPass123!' }),
      ).rejects.toThrow(UnauthorizedException);
      mockMfaUser.isActive = true;
    });
  });

  describe('2. MFA Challenge Token Security & Guard Hardening', () => {
    it('9. Expired MFA challenge token is rejected', async () => {
      const token = await mfaService.generateMfaChallengeToken(mockMfaUser.id, -10); // expired 10s ago
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: token, code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('10. Tampered MFA challenge token is rejected', async () => {
      const token = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      const tampered = token.slice(0, -5) + 'xxxxx';
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: tampered, code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('11. Challenge token with invalid purpose is rejected by MFA verify', async () => {
      const wrongToken = jwtService.sign({ sub: mockMfaUser.id, purpose: 'INVALID_PURPOSE' }, { secret: process.env.MFA_CHALLENGE_SECRET });
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: wrongToken, code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('12. JwtAuthGuard rejects MFA challenge tokens from accessing protected application APIs', async () => {
      const guard = new JwtAuthGuard(jwtService, mockPrismaService as any);
      const challengeToken = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: `Bearer ${challengeToken}` } }),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('13. MFA challenge token cannot pass as normal application JWT', async () => {
      const challengeToken = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      const decoded: any = jwtService.decode(challengeToken);
      expect(decoded.purpose).toBe('MFA_LOGIN');
    });

    it('14. Challenge token cannot be used to bypass password step', async () => {
      const fakeToken = jwtService.sign({ sub: 'random-user-id', purpose: 'MFA_LOGIN' }, { secret: process.env.MFA_CHALLENGE_SECRET });
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: fakeToken, code: '123456' }),
      ).rejects.toThrow();
    });
  });

  describe('3. RFC 6238 TOTP Engine & Clock Skew Window', () => {
    let testSecret: string;

    beforeEach(() => {
      testSecret = mfaService.generateTotpSecret();
    });

    it('15. RFC-compatible TOTP generates 6-digit numeric string', () => {
      const totp = mfaService.generateTotpCode(testSecret);
      expect(totp).toMatch(/^\d{6}$/);
    });

    it('16. Correct TOTP code is accepted within current time step', () => {
      const totp = mfaService.generateTotpCode(testSecret);
      const res = mfaService.verifyTotpCode(testSecret, totp);
      expect(res.valid).toBe(true);
      expect(res.timeStep).toBeDefined();
    });

    it('17. Incorrect TOTP code is rejected', () => {
      const res = mfaService.verifyTotpCode(testSecret, '000000');
      expect(res.valid).toBe(false);
    });

    it('18. TOTP is valid within ±1 time step window', () => {
      const pastStep = Math.floor(Date.now() / 1000 / 30) - 1; // 1 step ago
      const totpPast = mfaService.generateTotpCode(testSecret, pastStep);
      const res = mfaService.verifyTotpCode(testSecret, totpPast);
      expect(res.valid).toBe(true);
    });

    it('19. TOTP older than ±1 time step is rejected', () => {
      const oldStep = Math.floor(Date.now() / 1000 / 30) - 3; // 3 steps ago
      const oldTotp = mfaService.generateTotpCode(testSecret, oldStep);
      const res = mfaService.verifyTotpCode(testSecret, oldTotp);
      expect(res.valid).toBe(false);
    });

    it('20. Replay protection rejects same time step verification twice', async () => {
      const secret = mfaService.generateTotpSecret();
      mockMfaUser.mfaSecretEncrypted = mfaService.encryptSecret(secret);
      mockMfaUser.mfaLastUsedTimeStep = null;

      const challenge = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      const code = mfaService.generateTotpCode(secret);

      // First verification succeeds
      const res1 = await authService.verifyMfaLogin({ mfaChallengeToken: challenge, code });
      expect(res1.accessToken).toBeDefined();

      // Second attempt with SAME challenge token or SAME code & time step fails
      const challenge2 = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: challenge2, code }),
      ).rejects.toThrow('Authentication code already used. Please wait for the next time step.');
    });

    it('20b. Concurrent TOTP authentication attempts with same time step permit EXACTLY ONE success', async () => {
      const secret = mfaService.generateTotpSecret();
      mockMfaUser.mfaSecretEncrypted = mfaService.encryptSecret(secret);
      mockMfaUser.mfaLastUsedTimeStep = null;

      const code = mfaService.generateTotpCode(secret);
      const concurrentCount = 10;

      const challengeTokens = await Promise.all(
        Array.from({ length: concurrentCount }).map(() =>
          mfaService.generateMfaChallengeToken(mockMfaUser.id, 300),
        ),
      );

      const results = await Promise.allSettled(
        challengeTokens.map((token) =>
          authService.verifyMfaLogin({ mfaChallengeToken: token, code }),
        ),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(concurrentCount - 1);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect((rej.reason as any).message).toContain('Authentication code already used');
        }
      }
    });

    it('21. OTPauth provisioning URI is RFC-compliant format', () => {
      const uri = mfaService.generateOtpauthUrl('user.mfa@nyayavault.gov.in', testSecret);
      expect(uri).toContain('otpauth://totp/NyayaVault:user.mfa%40nyayavault.gov.in');
      expect(uri).toContain(`secret=${testSecret}`);
      expect(uri).toContain('issuer=NyayaVault');
    });

    it('22. Secret base32 encoding/decoding is valid', () => {
      expect(testSecret).toMatch(/^[A-Z2-7]+$/);
    });
  });

  describe('4. TOTP Secret AES-256-GCM Encryption at Rest', () => {
    it('23. Cryptographic secret is encrypted at rest using AES-256-GCM', () => {
      const secret = mfaService.generateTotpSecret();
      const encrypted = mfaService.encryptSecret(secret);
      expect(encrypted).not.toContain(secret);
      expect(encrypted.split(':')).toHaveLength(4); // v1:iv:tag:ciphertext
    });

    it('24. Decryption produces exact original TOTP secret', () => {
      const secret = mfaService.generateTotpSecret();
      const encrypted = mfaService.encryptSecret(secret);
      const decrypted = mfaService.decryptSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('25. Tampered ciphertext or auth tag fails decryption safely', () => {
      const secret = mfaService.generateTotpSecret();
      const encrypted = mfaService.encryptSecret(secret);
      const parts = encrypted.split(':');
      parts[2] = 'ffffffffffffffffffffffffffffffff'; // tampered tag
      const tampered = parts.join(':');

      expect(() => mfaService.decryptSecret(tampered)).toThrow();
    });

    it('26. Missing or invalid MFA_ENCRYPTION_KEY fails safely', () => {
      const oldKey = process.env.MFA_ENCRYPTION_KEY;
      delete process.env.MFA_ENCRYPTION_KEY;
      expect(() => mfaService.encryptSecret('JBSWY3DPEHPK3PXP')).toThrow('MFA_ENCRYPTION_KEY must be a valid 32-byte key.');
      process.env.MFA_ENCRYPTION_KEY = oldKey;
    });

    it('27. Plaintext secret is never saved directly to user record', () => {
      expect(mockMfaUser.mfaSecretEncrypted).not.toBeNull();
      expect(mockMfaUser.mfaSecretEncrypted).toContain('v1:');
    });

    it('28. Status endpoint never exposes mfaSecretEncrypted or raw secret', async () => {
      const status = await authService.getMfaStatus(mockMfaUser.id);
      expect((status as any).mfaSecretEncrypted).toBeUndefined();
      expect((status as any).secret).toBeUndefined();
      expect(status.enabled).toBe(true);
    });
  });

  describe('5. MFA Enrollment Workflow & Confirmation', () => {
    it('29. Initiate enrollment requires valid current password', async () => {
      await expect(
        authService.initiateMfaEnrollment(mockStandardUser.id, 'WrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('30. Initiate enrollment generates QR code URL and pending secret without enabling MFA', async () => {
      const res = await authService.initiateMfaEnrollment(mockStandardUser.id, 'StandardPass123!');
      expect(res.qrCodeUrl).toContain('data:image/svg+xml');
      expect(res.secret).toBeDefined();
      expect(mockStandardUser.mfaEnabled).toBe(false); // Not enabled yet
    });

    it('31. Confirming enrollment with invalid TOTP code fails and keeps MFA disabled', async () => {
      await expect(
        authService.confirmMfaEnrollment(mockStandardUser.id, '000000'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStandardUser.mfaEnabled).toBe(false);
    });

    it('32. Confirming enrollment with valid TOTP enables MFA and returns recovery codes once', async () => {
      // Initiate
      const init = await authService.initiateMfaEnrollment(mockStandardUser.id, 'StandardPass123!');
      // Generate valid code for pending secret
      const code = mfaService.generateTotpCode(init.secret);

      const confirm = await authService.confirmMfaEnrollment(mockStandardUser.id, code);
      expect(confirm.success).toBe(true);
      expect(confirm.recoveryCodes).toHaveLength(8);
      expect(mockStandardUser.mfaEnabled).toBe(true);
      expect(mockStandardUser.mfaEnrolledAt).toBeDefined();
    });

    it('33. Audit event MFA_ENABLED is created on enrollment', async () => {
      expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'MFA_ENABLED', userId: mockStandardUser.id }),
      );
    });

    it('34. User with already enabled MFA cannot re-enroll without disabling first', async () => {
      await expect(
        authService.initiateMfaEnrollment(mockStandardUser.id, 'StandardPass123!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Emergency Single-Use Recovery Codes', () => {
    let rawRecoveryCode: string;

    beforeAll(async () => {
      // Re-enroll mockMfaUser to generate fresh recovery codes
      mockMfaUser.mfaEnabled = false;
      const init = await authService.initiateMfaEnrollment(mockMfaUser.id, 'MfaPass123!');
      const code = mfaService.generateTotpCode(init.secret);
      const confirm = await authService.confirmMfaEnrollment(mockMfaUser.id, code);
      rawRecoveryCode = confirm.recoveryCodes[0];
    });

    it('35. Recovery codes are formatted as 32-character (128-bit entropy) uppercase hyphenated hex strings', () => {
      expect(rawRecoveryCode).toMatch(/^[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
    });

    it('36. Recovery codes are stored only as Argon2id hashes in database', async () => {
      const stored = mockRecoveryCodesStore.get(mockMfaUser.id) || [];
      expect(stored.length).toBe(8);
      expect(stored[0].codeHash).not.toEqual(rawRecoveryCode);
      expect(stored[0].codeHash).toContain('$argon2');
    });

    it('37. Valid recovery code completes MFA login and issues application tokens', async () => {
      const challengeToken = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      const res = await authService.verifyMfaLogin({ mfaChallengeToken: challengeToken, code: rawRecoveryCode });
      expect(res.accessToken).toBeDefined();
      expect(res.user.email).toBe(mockMfaUser.email);
    });

    it('38. Used recovery code is marked single-use and rejected on subsequent attempt', async () => {
      const challengeToken = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: challengeToken, code: rawRecoveryCode }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('39. Invalid recovery code is rejected', async () => {
      const challengeToken = await mfaService.generateMfaChallengeToken(mockMfaUser.id, 300);
      await expect(
        authService.verifyMfaLogin({ mfaChallengeToken: challengeToken, code: 'XXXX-YYYY-ZZZZ-WWWW' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('40. Regenerating recovery codes invalidates old codes and issues 8 new codes', async () => {
      const secret = mfaService.decryptSecret(mockMfaUser.mfaSecretEncrypted!);
      const totpCode = mfaService.generateTotpCode(secret);

      const res = await authService.regenerateRecoveryCodes(mockMfaUser.id, 'MfaPass123!', totpCode);
      expect(res.recoveryCodes).toHaveLength(8);
      expect(res.recoveryCodes[0]).not.toEqual(rawRecoveryCode);
    });
  });

  describe('7. MFA Disable Flow & Revocation', () => {
    it('41. Disabling MFA requires valid current password and valid TOTP', async () => {
      const secret = mfaService.decryptSecret(mockMfaUser.mfaSecretEncrypted!);
      const totpCode = mfaService.generateTotpCode(secret);

      const res = await authService.disableMfa(mockMfaUser.id, 'MfaPass123!', totpCode);
      expect(res.message).toBe('Multi-factor authentication disabled successfully.');
      expect(mockMfaUser.mfaEnabled).toBe(false);
      expect(mockMfaUser.mfaSecretEncrypted).toBeNull();
    });

    it('42. Disabling MFA invalidates all recovery codes', async () => {
      const remaining = mockRecoveryCodesStore.get(mockMfaUser.id) || [];
      expect(remaining.length).toBe(0);
    });

    it('43. Audit event MFA_DISABLED is created', () => {
      expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'MFA_DISABLED', userId: mockMfaUser.id }),
      );
    });
  });

  describe('8. Admin MFA Reset & RBAC Controls', () => {
    beforeAll(async () => {
      // Re-enable MFA for mockMfaUser
      const init = await authService.initiateMfaEnrollment(mockMfaUser.id, 'MfaPass123!');
      const code = mfaService.generateTotpCode(init.secret);
      await authService.confirmMfaEnrollment(mockMfaUser.id, code);
    });

    it('44. ADMIN can reset target user MFA state', async () => {
      const res = await authService.adminResetMfa(mockAdminUser.id, mockMfaUser.id);
      expect(res.message).toContain('reset successfully');
      expect(mockMfaUser.mfaEnabled).toBe(false);
      expect(mockMfaUser.mfaSecretEncrypted).toBeNull();
    });

    it('45. Admin reset creates audit event MFA_ADMIN_RESET', () => {
      expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'MFA_ADMIN_RESET', userId: mockAdminUser.id }),
      );
    });
  });

  describe('9. Password Reset & Account Invariants', () => {
    it('46. Password reset does NOT disable MFA for MFA-enabled accounts', async () => {
      // Set MFA enabled for mockAdminUser
      mockAdminUser.mfaEnabled = true;

      // Simulate password reset request & confirm
      await authService.requestPasswordReset({ email: mockAdminUser.email });
      const resetCallArgs = mockEmailService.sendPasswordResetEmail.mock.calls.slice(-1)[0];
      const rawToken = new URL(resetCallArgs[1]).searchParams.get('token')!;

      await authService.confirmPasswordReset({
        token: rawToken,
        newPassword: 'NewAdminPassword123!',
        confirmPassword: 'NewAdminPassword123!',
      });

      // MFA must still be enabled
      expect(mockAdminUser.mfaEnabled).toBe(true);
    });
  });

  describe('10. Privacy & Log Non-Exposure Invariants', () => {
    it('47. TOTP secret, recovery codes, passwords are never exposed in user objects', () => {
      const sanitized = authService.sanitizeUser(mockMfaUser);
      expect((sanitized as any).mfaSecretEncrypted).toBeUndefined();
      expect((sanitized as any).passwordHash).toBeUndefined();
      expect((sanitized as any).refreshTokenHash).toBeUndefined();
    });
  });
});
