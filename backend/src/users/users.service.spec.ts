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

  const mockPrismaService = {
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
});
