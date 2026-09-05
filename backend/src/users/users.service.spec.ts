import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditChainService } from '../security/audit-chain.service';
import { RoleName } from '@prisma/client';

describe('UsersService (Admin User Management)', () => {
  let service: UsersService;

  const mockUserDb = new Map<string, any>();
  const mockRegDb = new Map<string, any>();

  const mockPrismaService = {
    registrationRequest: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id) return mockRegDb.get(where.id) || null;
        if (where.email) {
          for (const req of mockRegDb.values()) {
            if (req.email === where.email) return req;
          }
        }
        return null;
      }),
      findMany: jest.fn().mockImplementation(async () => {
        return Array.from(mockRegDb.values());
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const req = mockRegDb.get(where.id);
        if (req) Object.assign(req, data);
        return req;
      }),
    },
    user: {
      findMany: jest.fn().mockImplementation(async () => {
        return Array.from(mockUserDb.values()).map(({ passwordHash, refreshTokenHash, ...user }) => user);
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id) {
          return mockUserDb.get(where.id) || null;
        }
        if (where.email) {
          for (const u of mockUserDb.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `user-uuid-${mockUserDb.size + 1}`;
        const user = {
          id,
          email: data.email,
          fullName: data.fullName,
          passwordHash: data.passwordHash,
          role: data.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUserDb.set(id, user);
        return user;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const user = mockUserDb.get(where.id);
        if (!user) throw new NotFoundException('User not found');
        if ('role' in data) user.role = data.role;
        if ('isActive' in data) user.isActive = data.isActive;
        return user;
      }),
    },
    userSession: {
      updateMany: jest.fn().mockImplementation(async () => ({ count: 1 })),
    },
  };

  beforeAll(async () => {
    const mockAuditChainService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'audit-mock-id', sequenceNumber: '1' }),
      verifyChain: jest.fn().mockResolvedValue({ valid: true, totalEvents: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditChainService, useValue: mockAuditChainService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  beforeEach(() => {
    mockUserDb.clear();
  });

  describe('1. Create User', () => {
    it('should create a new user with Argon2 password hashing', async () => {
      const newUser = await service.createUser({
        email: 'new.officer@nyayavault.gov.in',
        fullName: 'Officer Kumar',
        password: 'Password123!',
        role: RoleName.INVESTIGATING_OFFICER,
      });

      expect(newUser).toHaveProperty('id');
      expect(newUser.email).toBe('new.officer@nyayavault.gov.in');
      expect(newUser.role).toBe(RoleName.INVESTIGATING_OFFICER);
      expect((newUser as any).passwordHash).toBeUndefined();

      // Verify Argon2 hash in DB
      const dbRecord = mockUserDb.get(newUser.id);
      expect(dbRecord.passwordHash).not.toBe('Password123!');
      expect(await argon2.verify(dbRecord.passwordHash, 'Password123!')).toBe(true);
    });

    it('should reject creation if email already exists', async () => {
      await service.createUser({
        email: 'duplicate@nyayavault.gov.in',
        fullName: 'Original User',
        password: 'Password123!',
        role: RoleName.PROSECUTOR,
      });

      await expect(
        service.createUser({
          email: 'duplicate@nyayavault.gov.in',
          fullName: 'Duplicate User',
          password: 'Password123!',
          role: RoleName.PROSECUTOR,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. List & Get Users', () => {
    it('should list users without exposing sensitive password hashes', async () => {
      await service.createUser({
        email: 'u1@nyayavault.gov.in',
        fullName: 'User 1',
        password: 'Password123!',
        role: RoleName.SUPERVISOR,
      });

      const users = await service.findAll();
      expect(users.length).toBe(1);
      expect((users[0] as any).passwordHash).toBeUndefined();
    });
  });

  describe('3. Update User Role & Status', () => {
    it('should update user role', async () => {
      const created = await service.createUser({
        email: 'promoted@nyayavault.gov.in',
        fullName: 'Officer Smith',
        password: 'Password123!',
        role: RoleName.INVESTIGATING_OFFICER,
      });

      const updated = await service.updateUserRole(created.id, { role: RoleName.SUPERVISOR });
      expect(updated.role).toBe(RoleName.SUPERVISOR);
    });

    it('should deactivate user and trigger session revocation', async () => {
      const created = await service.createUser({
        email: 'to_deactivate@nyayavault.gov.in',
        fullName: 'Officer Doe',
        password: 'Password123!',
        role: RoleName.INVESTIGATING_OFFICER,
      });

      const deactivated = await service.updateUserStatus(created.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);
      expect(mockPrismaService.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: created.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('4. Admin Registration Approval Workflow', () => {
    it('should approve a pending registration and create active user account', async () => {
      const regId = 'reg-req-101';
      const passHash = await argon2.hash('SecretPass123!');
      mockRegDb.set(regId, {
        id: regId,
        email: 'applicant.approved@nyayavault.gov.in',
        fullName: 'Approved Officer',
        passwordHash: passHash,
        requestedRole: RoleName.INVESTIGATING_OFFICER,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        createdAt: new Date(),
      });

      const approvedUser = await service.approveRegistration(regId, 'admin-id-1');
      expect(approvedUser.email).toBe('applicant.approved@nyayavault.gov.in');
      expect(approvedUser.role).toBe(RoleName.INVESTIGATING_OFFICER);
      expect(approvedUser.isActive).toBe(true);

      const regRecord = mockRegDb.get(regId);
      expect(regRecord.status).toBe('APPROVED');
      expect(regRecord.reviewedById).toBe('admin-id-1');
    });

    it('should reject a pending registration with rejection reason', async () => {
      const regId = 'reg-req-102';
      mockRegDb.set(regId, {
        id: regId,
        email: 'applicant.rejected@nyayavault.gov.in',
        fullName: 'Rejected Applicant',
        passwordHash: 'hash',
        requestedRole: RoleName.PROSECUTOR,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        createdAt: new Date(),
      });

      const rejectedRes = await service.rejectRegistration(regId, 'Incomplete verification documents', 'admin-id-1');
      expect(rejectedRes.status).toBe('REJECTED');
      expect(rejectedRes.rejectionReason).toBe('Incomplete verification documents');
    });
  });
});
