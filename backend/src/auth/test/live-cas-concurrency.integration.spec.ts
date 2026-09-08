import * as dns from 'dns';
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { PrismaClient, RoleName } from '@prisma/client';
import * as crypto from 'crypto';

describe('REAL PostgreSQL Atomic TOTP Compare-And-Set (CAS) Concurrency Integration Test', () => {
  let prisma: PrismaClient;
  let testUserId: string;

  beforeAll(async () => {
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

    const testEmail = `mfa-cas-test-${crypto.randomUUID()}@nyayavault.internal`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'dummy_hash',
        fullName: 'Integration Test User',
        role: RoleName.INVESTIGATING_OFFICER,
        mfaEnabled: true,
        mfaSecretEncrypted: 'v1:dummy:dummy:dummy',
        mfaLastUsedTimeStep: null,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId && prisma) {
      await prisma.mfaRecoveryCode.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
      await prisma.$disconnect();
    }
  });

  it('proves exactly 1 concurrent CAS update succeeds and 9 fail when submitting the SAME timestep against REAL PostgreSQL', async () => {
    const timeStep = 5550000;
    const concurrentAttempts = 10;

    const results = await Promise.all(
      Array.from({ length: concurrentAttempts }).map(() =>
        prisma.user.updateMany({
          where: {
            id: testUserId,
            OR: [
              { mfaLastUsedTimeStep: null },
              { mfaLastUsedTimeStep: { lt: timeStep } },
            ],
          },
          data: { mfaLastUsedTimeStep: timeStep },
        }),
      ),
    );

    const successCount = results.filter((r) => r.count === 1).length;
    const rejectionCount = results.filter((r) => r.count === 0).length;

    expect(successCount).toBe(1);
    expect(rejectionCount).toBe(9);

    const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(updatedUser?.mfaLastUsedTimeStep).toBe(timeStep);

    // Subsequent attempt with SAME timestep T fails
    const reAttempt = await prisma.user.updateMany({
      where: {
        id: testUserId,
        OR: [
          { mfaLastUsedTimeStep: null },
          { mfaLastUsedTimeStep: { lt: timeStep } },
        ],
      },
      data: { mfaLastUsedTimeStep: timeStep },
    });
    expect(reAttempt.count).toBe(0);

    // Subsequent attempt with older timestep T-1 fails
    const olderAttempt = await prisma.user.updateMany({
      where: {
        id: testUserId,
        OR: [
          { mfaLastUsedTimeStep: null },
          { mfaLastUsedTimeStep: { lt: timeStep - 1 } },
        ],
      },
      data: { mfaLastUsedTimeStep: timeStep - 1 },
    });
    expect(olderAttempt.count).toBe(0);

    // Subsequent attempt with newer timestep T+1 succeeds
    const nextTimeStep = timeStep + 1;
    const nextAttempt = await prisma.user.updateMany({
      where: {
        id: testUserId,
        OR: [
          { mfaLastUsedTimeStep: null },
          { mfaLastUsedTimeStep: { lt: nextTimeStep } },
        ],
      },
      data: { mfaLastUsedTimeStep: nextTimeStep },
    });
    expect(nextAttempt.count).toBe(1);

    const finalUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(finalUser?.mfaLastUsedTimeStep).toBe(nextTimeStep);
  });
});
