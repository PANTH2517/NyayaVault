import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditChainService } from '../security/audit-chain.service';
import { AuditEventType, RegistrationStatus, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditChainService: AuditChainService,
  ) {}

  /**
   * List all users (excluding hashes)
   */
  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  /**
   * Get user detail by ID (excluding hashes)
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  /**
   * Create a new user with Argon2 password hashing (ADMIN only)
   */
  async createUser(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        role: dto.role,
      },
    });

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId: user.id,
      action: 'USER_CREATED',
      metadata: { email: dto.email, role: dto.role },
    });

    return this.sanitizeUser(user);
  }

  /**
   * Update user role (ADMIN only)
   */
  async updateUserRole(id: string, dto: UpdateUserRoleDto) {
    await this.findOne(id); // verify existence

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.CASE_ACCESS_GRANTED,
      userId: id,
      action: 'ROLE_CHANGED',
      metadata: { newRole: dto.role },
    });

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Update user active status (ADMIN only).
   * Deactivating a user immediately revokes all active UserSession records.
   */
  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    await this.findOne(id); // verify existence

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    if (!dto.isActive) {
      // Deactivation: revoke all active sessions immediately
      await this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditChainService.recordEvent({
        eventType: AuditEventType.CASE_ACCESS_REVOKED,
        userId: id,
        action: 'ACCOUNT_DISABLED',
      });
    } else {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.CASE_ACCESS_GRANTED,
        userId: id,
        action: 'ACCOUNT_ENABLED',
      });
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * List all registration requests (ADMIN only)
   */
  async getPendingRegistrations() {
    const requests = await this.prisma.registrationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        requestedRole: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
    return requests;
  }

  /**
   * Approve a pending registration request (ADMIN only)
   */
  async approveRegistration(id: string, adminUserId: string) {
    const regReq = await this.prisma.registrationRequest.findUnique({
      where: { id },
    });

    if (!regReq) {
      throw new NotFoundException(`Registration request with ID '${id}' not found`);
    }

    if (regReq.status !== RegistrationStatus.PENDING) {
      throw new ConflictException(`Registration request is already ${regReq.status}`);
    }

    // Check if user account already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: regReq.email },
    });

    let user: User;
    if (existingUser) {
      user = existingUser;
    } else {
      user = await this.prisma.user.create({
        data: {
          email: regReq.email,
          fullName: regReq.fullName,
          passwordHash: regReq.passwordHash,
          role: regReq.requestedRole,
          isActive: true,
        },
      });
    }

    await this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationStatus.APPROVED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.REGISTRATION_APPROVED,
      userId: adminUserId,
      action: `Approved registration for ${regReq.fullName} (${regReq.email}) as ${regReq.requestedRole}`,
      metadata: {
        registrationRequestId: id,
        email: regReq.email,
        requestedRole: regReq.requestedRole,
      },
    });

    return this.sanitizeUser(user);
  }

  /**
   * Reject a pending registration request (ADMIN only)
   */
  async rejectRegistration(id: string, rejectionReason: string | undefined, adminUserId: string) {
    const regReq = await this.prisma.registrationRequest.findUnique({
      where: { id },
    });

    if (!regReq) {
      throw new NotFoundException(`Registration request with ID '${id}' not found`);
    }

    if (regReq.status !== RegistrationStatus.PENDING) {
      throw new ConflictException(`Registration request is already ${regReq.status}`);
    }

    const updated = await this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationStatus.REJECTED,
        rejectionReason: rejectionReason || null,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        requestedRole: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.REGISTRATION_REJECTED,
      userId: adminUserId,
      action: `Rejected registration for ${regReq.fullName} (${regReq.email})`,
      metadata: {
        registrationRequestId: id,
        email: regReq.email,
        rejectionReason,
      },
    });

    return updated;
  }

  /**
   * Strict security invariant: exclude passwordHash and refreshTokenHash
   */
  private sanitizeUser(user: User) {
    const { passwordHash, refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }
}
