import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create new case (ADMIN only)
   */
  async createCase(createCaseDto: CreateCaseDto, creatorUserId: string) {
    const existingCase = await this.prisma.case.findUnique({
      where: { caseNumber: createCaseDto.caseNumber },
    });

    if (existingCase) {
      throw new ConflictException(`Case number '${createCaseDto.caseNumber}' already exists`);
    }

    return this.prisma.case.create({
      data: {
        caseNumber: createCaseDto.caseNumber,
        title: createCaseDto.title,
        description: createCaseDto.description,
        status: createCaseDto.status,
        createdById: creatorUserId,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });
  }

  /**
   * List cases enforcing backend database authorization filtering:
   * - ADMIN gets all cases.
   * - Non-admin users get only cases assigned to them in the database query.
   */
  async findAllForUser(user: UserPayload) {
    if (user.role === RoleName.ADMIN) {
      return this.prisma.case.findMany({
        include: {
          createdBy: { select: { id: true, email: true, fullName: true, role: true } },
          assignments: {
            include: {
              user: { select: { id: true, email: true, fullName: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.case.findMany({
      where: {
        assignments: {
          some: {
            userId: user.userId,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, email: true, fullName: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find single case by ID (Protected by CBAC guard)
   */
  async findOne(caseId: string) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, email: true, fullName: true, role: true } },
          },
        },
        documents: true,
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case with ID '${caseId}' not found`);
    }

    return caseRecord;
  }

  /**
   * Update case details (Protected by CBAC guard & Role check)
   */
  async updateCase(caseId: string, updateCaseDto: UpdateCaseDto, user: UserPayload) {
    if (user.role === RoleName.SUPERVISOR || user.role === RoleName.PROSECUTOR) {
      throw new ForbiddenException(`Role '${user.role}' is not authorized to edit case metadata`);
    }

    await this.findOne(caseId); // Verify existence

    return this.prisma.case.update({
      where: { id: caseId },
      data: {
        title: updateCaseDto.title,
        description: updateCaseDto.description,
        status: updateCaseDto.status,
      },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, email: true, fullName: true, role: true } },
          },
        },
      },
    });
  }

  /**
   * Assign user to case (ADMIN only)
   */
  async assignUser(caseId: string, assignUserDto: AssignUserDto) {
    // 1. Verify case exists
    await this.findOne(caseId);

    // 2. Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: assignUserDto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException(`Target user with ID '${assignUserDto.userId}' not found`);
    }

    // 3. Prevent duplicate assignments
    const existingAssignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: assignUserDto.userId,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(`User '${targetUser.email}' is already assigned to this case`);
    }

    return this.prisma.caseAssignment.create({
      data: {
        caseId,
        userId: assignUserDto.userId,
        roleInCase: assignUserDto.roleInCase,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });
  }

  /**
   * Remove user assignment from case (ADMIN only)
   */
  async removeAssignment(caseId: string, userId: string) {
    const existingAssignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
    });

    if (!existingAssignment) {
      throw new NotFoundException(`Assignment for user '${userId}' in case '${caseId}' not found`);
    }

    await this.prisma.caseAssignment.delete({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
    });

    return { message: 'User assignment removed successfully' };
  }
}
