import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';

describe('AuthModule Unit & Integration Suite (Milestone 3)', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  // Mocked Database State
  const mockUser = {
    id: 'user-uuid-101',
    email: 'admin@nyayavault.gov.in',
    fullName: 'System Administrator',
    passwordHash: '', // Set in beforeAll
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

  const mockPrismaService = {
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
          if ('refreshTokenHash' in data) mockUser.refreshTokenHash = data.refreshTokenHash;
          return mockUser;
        }
        if (where.id === mockOfficerUser.id) {
          if ('refreshTokenHash' in data) mockOfficerUser.refreshTokenHash = data.refreshTokenHash;
          return mockOfficerUser;
        }
        return null;
      }),
    },
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('Admin@Nyaya2026');
    mockOfficerUser.passwordHash = await argon2.hash('Officer@Nyaya2026');

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

  describe('2. Login Authentication', () => {
    it('should successfully log in with valid credentials and return tokens without passwordHash', async () => {
      const result = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@nyayavault.gov.in');
      expect(result.user.role).toBe(RoleName.ADMIN);

      // Verify strict security non-exposure invariant
      expect((result.user as any).passwordHash).toBeUndefined();
      expect((result.user as any).refreshTokenHash).toBeUndefined();
    });

    it('should reject login with invalid password', async () => {
      await expect(
        authService.login({
          email: 'admin@nyayavault.gov.in',
          password: 'IncorrectPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login with non-existent email', async () => {
      await expect(
        authService.login({
          email: 'unknown@nyayavault.gov.in',
          password: 'Admin@Nyaya2026',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('3. JWT Access Token Guard', () => {
    it('should validate valid JWT bearer token in JwtAuthGuard', async () => {
      const guard = new JwtAuthGuard(jwtService);
      const token = await jwtService.signAsync(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        { secret: 'dev_jwt_secret_key_for_local_testing_only' },
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${token}` },
          }),
        }),
      } as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
    });

    it('should reject requests with missing authorization header', async () => {
      const guard = new JwtAuthGuard(jwtService);
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. RBAC Roles Guard Enforcement', () => {
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

    it('should deny access when user role (INVESTIGATING_OFFICER) does not match required role (ADMIN)', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.ADMIN]);
      const guard = new RolesGuard(reflector);

      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: mockOfficerUser.id, email: mockOfficerUser.email, role: RoleName.INVESTIGATING_OFFICER },
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('5. Refresh Token Rotation & Logout', () => {
    it('should rotate tokens successfully when valid refresh token is submitted', async () => {
      // 1. Perform initial login to generate stored refreshTokenHash
      const loginRes = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });

      // 2. Perform refresh
      const refreshRes = await authService.refreshTokens({
        refreshToken: loginRes.refreshToken,
      });

      expect(refreshRes).toHaveProperty('accessToken');
      expect(refreshRes).toHaveProperty('refreshToken');
      expect(refreshRes.accessToken).not.toEqual(loginRes.accessToken);
    });

    it('should invalidate refresh token on logout', async () => {
      // 1. Perform login
      const loginRes = await authService.login({
        email: 'admin@nyayavault.gov.in',
        password: 'Admin@Nyaya2026',
      });

      // 2. Logout
      const logoutRes = await authService.logout(mockUser.id);
      expect(logoutRes.message).toBe('Logged out successfully');
      expect(mockUser.refreshTokenHash).toBeNull();

      // 3. Subsequent refresh attempt must fail
      await expect(
        authService.refreshTokens({
          refreshToken: loginRes.refreshToken,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
