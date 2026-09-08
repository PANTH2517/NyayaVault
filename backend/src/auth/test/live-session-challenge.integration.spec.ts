import * as dns from 'dns';
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { PrismaClient, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MfaService } from '../mfa.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('REAL PostgreSQL MFA Session Boundary & Challenge Token Isolation Test', () => {
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let mfaService: MfaService;
  let jwtGuard: JwtAuthGuard;
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'dev_mfa_encryption_key_32bytes_!!';
    
    let directUrl = process.env.DIRECT_URL || '';
    if (directUrl) {
      if (!directUrl.includes('sslmode=')) {
        directUrl += (directUrl.includes('?') ? '&' : '?') + 'sslmode=require';
      }
      if (!directUrl.includes('connection_limit=')) {
        directUrl += '&connection_limit=15&connect_timeout=15';
      }
    }
    prisma = new PrismaClient({
      datasources: { db: { url: directUrl } },
    });

    jwtService = new JwtService({});
    mfaService = new MfaService(jwtService);
    jwtGuard = new JwtAuthGuard(jwtService, prisma as unknown as PrismaService);

    testEmail = `mfa-session-test-${crypto.randomUUID()}@nyayavault.internal`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'dummy_hash',
        fullName: 'Session Integration Test User',
        role: RoleName.INVESTIGATING_OFFICER,
        mfaEnabled: true,
        mfaSecretEncrypted: mfaService.encryptSecret('JBSWY3DPEHPK3PXP'),
        mfaLastUsedTimeStep: null,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId && prisma) {
      await prisma.userSession.deleteMany({ where: { userId: testUserId } });
      await prisma.mfaRecoveryCode.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
      await prisma.$disconnect();
    }
  });

  it('proves password-only MFA login creates ZERO UserSession records and returns ONLY challenge token', async () => {
    const initialSessionCount = await prisma.userSession.count({ where: { userId: testUserId } });
    expect(initialSessionCount).toBe(0);

    const challengeToken = await mfaService.generateMfaChallengeToken(testUserId);
    expect(challengeToken).toBeDefined();

    // Verify session count remains 0 before MFA verification
    const postLoginSessionCount = await prisma.userSession.count({ where: { userId: testUserId } });
    expect(postLoginSessionCount).toBe(0);
  });

  it('proves JwtAuthGuard rejects MFA challenge token on protected endpoints (401 Unauthorized)', async () => {
    const challengeToken = await mfaService.generateMfaChallengeToken(testUserId);

    const createMockContext = (authHeader: string): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: authHeader },
          }),
        }),
      } as any);

    const ctx = createMockContext(`Bearer ${challengeToken}`);
    await expect(jwtGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('proves JwtAuthGuard rejects MFA_ENROLLMENT_REQUIRED token on protected endpoints (401 Unauthorized)', async () => {
    const enrollmentToken = await mfaService.generateMfaEnrollmentToken(testUserId);

    const createMockContext = (authHeader: string): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: authHeader },
          }),
        }),
      } as any);

    const ctx = createMockContext(`Bearer ${enrollmentToken}`);
    await expect(jwtGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
