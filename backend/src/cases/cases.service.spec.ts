import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ForbiddenException, NotFoundException, ConflictException, ExecutionContext } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseAccessGuard } from './guards/case-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { RoleName, CaseStatus } from '@prisma/client';

describe('CasesModule & CBAC Test Suite (Milestone 4)', () => {
  let casesService: CasesService;
  let caseAccessGuard: CaseAccessGuard;
  let rolesGuard: RolesGuard;
  let jwtAuthGuard: JwtAuthGuard;
  let jwtService: JwtService;

  // Mock User Identities
  const adminUser = {
    userId: 'usr-admin-1',
    email: 'admin@nyayavault.gov.in',
    role: RoleName.ADMIN,
  };

  const ioUser = {
    userId: 'usr-io-2',
    email: 'io.sharma@nyayavault.gov.in',
    role: RoleName.INVESTIGATING_OFFICER,
  };

  const supervisorUser = {
    userId: 'usr-super-3',
    email: 'super.verma@nyayavault.gov.in',
    role: RoleName.SUPERVISOR,
  };

  const prosecutorUser = {
    userId: 'usr-prosecutor-4',
    email: 'prosecutor.mehta@nyayavault.gov.in',
    role: RoleName.PROSECUTOR,
  };

  // Mock Cases & Assignments
  const case1 = {
    id: 'case-001',
    caseNumber: 'CR-2026-0042',
    title: 'Cyber Heist Investigation',
    description: 'Data exfiltration incident',
    status: CaseStatus.UNDER_INVESTIGATION,
    createdById: adminUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const case2 = {
    id: 'case-002',
    caseNumber: 'CR-2026-0108',
    title: 'Financial Fraud Case',
    description: 'Falsified audit books',
    status: CaseStatus.OPEN,
    createdById: supervisorUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // In-memory assignments list
  let assignmentsStore: Array<{ id: string; caseId: string; userId: string; roleInCase?: string }> = [
    { id: 'asgn-1', caseId: case1.id, userId: ioUser.userId, roleInCase: 'Lead Officer' },
    { id: 'asgn-2', caseId: case1.id, userId: supervisorUser.userId, roleInCase: 'Supervisor' },
  ];

  const mockPrismaService = {
    case: {
      findMany: jest.fn().mockImplementation(async (query) => {
        // Verify database query filtering
        if (query?.where?.assignments?.some?.userId) {
          const filterUserId = query.where.assignments.some.userId;
          const assignedCaseIds = assignmentsStore
            .filter((a) => a.userId === filterUserId)
            .map((a) => a.caseId);
          return [case1, case2].filter((c) => assignedCaseIds.includes(c.id));
        }
        return [case1, case2]; // ADMIN receives all cases
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === case1.id) return case1;
        if (where.id === case2.id) return case2;
        if (where.caseNumber === case1.caseNumber) return case1;
        if (where.caseNumber === case2.caseNumber) return case2;
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        return { id: 'case-new-99', ...data, createdAt: new Date(), updatedAt: new Date() };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        return { ...case1, ...data };
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === ioUser.userId) return { id: ioUser.userId, email: ioUser.email, role: ioUser.role };
        if (where.id === prosecutorUser.userId) return { id: prosecutorUser.userId, email: prosecutorUser.email, role: prosecutorUser.role };
        return null;
      }),
    },
    caseAssignment: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const { caseId, userId } = where.caseId_userId;
        return assignmentsStore.find((a) => a.caseId === caseId && a.userId === userId) || null;
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const newAsgn = { id: `asgn-${Date.now()}`, ...data };
        assignmentsStore.push(newAsgn);
        return newAsgn;
      }),
      delete: jest.fn().mockImplementation(async ({ where }) => {
        const { caseId, userId } = where.caseId_userId;
        const index = assignmentsStore.findIndex((a) => a.caseId === caseId && a.userId === userId);
        if (index === -1) throw new NotFoundException('Assignment not found');
        const [removed] = assignmentsStore.splice(index, 1);
        return removed;
      }),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'dev_jwt_secret_key_for_local_testing_only',
        }),
      ],
      providers: [
        CasesService,
        CaseAccessGuard,
        RolesGuard,
        JwtAuthGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    casesService = module.get<CasesService>(CasesService);
    caseAccessGuard = module.get<CaseAccessGuard>(CaseAccessGuard);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  // --------------------------------------------------------
  // Test Scenario 1: ADMIN can list all cases
  // --------------------------------------------------------
  it('1. ADMIN can list all cases in the repository', async () => {
    const cases = await casesService.findAllForUser(adminUser);
    expect(cases).toHaveLength(2);
    expect(cases.map((c) => c.id)).toEqual(['case-001', 'case-002']);
  });

  // --------------------------------------------------------
  // Test Scenario 2: INVESTIGATING_OFFICER receives only assigned cases
  // --------------------------------------------------------
  it('2. INVESTIGATING_OFFICER receives only cases assigned to them via database query filtering', async () => {
    const cases = await casesService.findAllForUser(ioUser);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe('case-001');
  });

  // --------------------------------------------------------
  // Test Scenario 3: SUPERVISOR cannot access an unrelated case
  // --------------------------------------------------------
  it('3. SUPERVISOR is denied access to an unassigned case (case-002)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: supervisorUser,
          params: { id: case2.id },
        }),
      }),
    } as ExecutionContext;

    await expect(caseAccessGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  // --------------------------------------------------------
  // Test Scenario 4: PROSECUTOR cannot access an unrelated case
  // --------------------------------------------------------
  it('4. PROSECUTOR is denied access to an unassigned case (case-001 & case-002)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: prosecutorUser,
          params: { id: case1.id },
        }),
      }),
    } as ExecutionContext;

    await expect(caseAccessGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  // --------------------------------------------------------
  // Test Scenario 5: ADMIN can access any case
  // --------------------------------------------------------
  it('5. ADMIN is granted access to any case regardless of assignment', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: adminUser,
          params: { id: case2.id },
        }),
      }),
    } as ExecutionContext;

    const canAccess = await caseAccessGuard.canActivate(mockContext);
    expect(canAccess).toBe(true);
  });

  // --------------------------------------------------------
  // Test Scenario 6: Unauthenticated requests are rejected
  // --------------------------------------------------------
  it('6. Unauthenticated request without JWT header is rejected with 401 Unauthorized', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    await expect(jwtAuthGuard.canActivate(mockContext)).rejects.toThrow();
  });

  // --------------------------------------------------------
  // Test Scenario 7: ADMIN can assign a user to a case
  // --------------------------------------------------------
  it('7. ADMIN can assign PROSECUTOR to case-001', async () => {
    const assignment = await casesService.assignUser(case1.id, {
      userId: prosecutorUser.userId,
      roleInCase: 'Assigned Prosecutor',
    });

    expect(assignment).toHaveProperty('id');
    expect(assignment.userId).toBe(prosecutorUser.userId);
    expect(assignment.caseId).toBe(case1.id);
  });

  // --------------------------------------------------------
  // Test Scenario 8: Duplicate assignment is rejected
  // --------------------------------------------------------
  it('8. Assigning an already assigned user (PROSECUTOR to case-001) throws 409 Conflict', async () => {
    await expect(
      casesService.assignUser(case1.id, {
        userId: prosecutorUser.userId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  // --------------------------------------------------------
  // Test Scenario 9: After assignment removal, user cannot access case
  // --------------------------------------------------------
  it('9. Removing PROSECUTOR assignment immediately revokes CBAC case access', async () => {
    // 1. Verify PROSECUTOR currently has access post-assignment
    const mockContextBefore = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: prosecutorUser,
          params: { id: case1.id },
        }),
      }),
    } as ExecutionContext;
    expect(await caseAccessGuard.canActivate(mockContextBefore)).toBe(true);

    // 2. ADMIN removes assignment
    await casesService.removeAssignment(case1.id, prosecutorUser.userId);

    // 3. Verify PROSECUTOR is now denied access
    const mockContextAfter = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: prosecutorUser,
          params: { id: case1.id },
        }),
      }),
    } as ExecutionContext;
    await expect(caseAccessGuard.canActivate(mockContextAfter)).rejects.toThrow(ForbiddenException);
  });

  // --------------------------------------------------------
  // Test Scenario 10: Non-admin users cannot manage assignments
  // --------------------------------------------------------
  it('10. Non-admin users (INVESTIGATING_OFFICER) are blocked from assignment management via RolesGuard', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.ADMIN]);
    const guard = new RolesGuard(reflector);

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: ioUser,
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  // --------------------------------------------------------
  // Test Scenario 11: Backend database query filtering
  // --------------------------------------------------------
  it('11. Database query filtering occurs inside CasesService.findAllForUser without returning unassigned cases', async () => {
    const casesForIO = await casesService.findAllForUser(ioUser);
    expect(mockPrismaService.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignments: {
            some: {
              userId: ioUser.userId,
            },
          },
        },
      }),
    );
    expect(casesForIO.every((c) => c.id === case1.id)).toBe(true);
  });

  // --------------------------------------------------------
  // Test Scenario 12: SUPERVISOR & PROSECUTOR cannot edit case metadata
  // --------------------------------------------------------
  it('12. SUPERVISOR and PROSECUTOR are denied from editing case metadata (403 Forbidden)', async () => {
    await expect(
      casesService.updateCase(case1.id, { title: 'Unauthorized Edit' }, supervisorUser),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      casesService.updateCase(case1.id, { title: 'Unauthorized Edit' }, prosecutorUser),
    ).rejects.toThrow(ForbiddenException);
  });

  // --------------------------------------------------------
  // Test Scenario 13: ADMIN & INVESTIGATING_OFFICER can edit case metadata
  // --------------------------------------------------------
  it('13. ADMIN and INVESTIGATING_OFFICER are authorized to edit case metadata', async () => {
    const updatedByAdmin = await casesService.updateCase(case1.id, { title: 'Updated Heist Title' }, adminUser);
    expect(updatedByAdmin).toHaveProperty('title');

    const updatedByIO = await casesService.updateCase(case1.id, { title: 'Updated Heist Title 2' }, ioUser);
    expect(updatedByIO).toHaveProperty('title');
  });
});
