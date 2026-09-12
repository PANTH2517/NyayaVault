import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { AuditChainService } from '../security/audit-chain.service';
import { CreateShareDto } from './dto/create-share.dto';
import { ListActiveSharesDto } from './dto/list-active-shares.dto';
import { UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName, ShareStatus, AuditEventType } from '@prisma/client';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly auditChainService: AuditChainService,
  ) {}

  /**
   * Helper to derive effective ShareStatus based on timestamps & revocation
   */
  private deriveEffectiveStatus(share: {
    status: ShareStatus;
    revokedAt: Date | null;
    expiresAt: Date;
  }): ShareStatus {
    if (share.revokedAt != null || share.status === ShareStatus.REVOKED) {
      return ShareStatus.REVOKED;
    }
    if (new Date() >= share.expiresAt) {
      return ShareStatus.EXPIRED;
    }
    return ShareStatus.ACTIVE;
  }

  /**
   * Helper to compute SHA-256 token hash
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Verify case access permissions for user
   */
  private async validateCaseAccess(caseId: string, userId: string, role: RoleName): Promise<void> {
    if (role === RoleName.ADMIN) {
      return;
    }

    const assignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Access denied: You are not assigned to this case');
    }
  }

  /**
   * Get Eligible Recipients for Case (Case-Assigned Active Users Only)
   */
  async getEligibleRecipientsForCase(caseId: string, user: UserPayload) {
    // 1. Verify caller has access to case
    await this.validateCaseAccess(caseId, user.userId, user.role as RoleName);

    // 2. Fetch assigned active users excluding current user
    const assignments = await this.prisma.caseAssignment.findMany({
      where: {
        caseId,
        user: {
          isActive: true,
          id: { not: user.userId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return assignments.map((a) => a.user);
  }

  /**
   * Create Time-Bound Evidence Share
   */
  async createShare(dto: CreateShareDto, user: UserPayload) {
    // 1. Fetch Document Version & Document
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: dto.versionId },
      include: { document: true },
    });

    if (!version) {
      throw new NotFoundException(`Document version '${dto.versionId}' not found`);
    }

    const caseId = version.document.caseId;

    // 2. Verify Issuer Authorization to Case
    await this.validateCaseAccess(caseId, user.userId, user.role as RoleName);

    // 3. Verify Target User Exists, Active, & Assigned to Case
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new BadRequestException('Target recipient user is inactive or does not exist');
    }

    if (targetUser.id === user.userId) {
      throw new BadRequestException('Cannot share evidence with yourself');
    }

    if (targetUser.role !== RoleName.ADMIN) {
      const targetAssignment = await this.prisma.caseAssignment.findUnique({
        where: {
          caseId_userId: {
            caseId,
            userId: dto.targetUserId,
          },
        },
      });

      if (!targetAssignment) {
        throw new BadRequestException('Target recipient is not assigned to this case');
      }
    }

    // 4. Generate 32 Cryptographically Random Bytes (64 Hex Chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + dto.expirationHours * 3600 * 1000);

    // 5. Transactional DB Creation & Audit Event Append
    const share = await this.prisma.$transaction(async (tx) => {
      const createdShare = await tx.evidenceShare.create({
        data: {
          versionId: dto.versionId,
          caseId,
          issuedById: user.userId,
          targetUserId: dto.targetUserId,
          tokenHash,
          expiresAt,
          status: ShareStatus.ACTIVE,
        },
        include: {
          targetUser: { select: { id: true, email: true, fullName: true, role: true } },
          issuedBy: { select: { id: true, email: true, fullName: true, role: true } },
        },
      });

      return createdShare;
    });

    // Record SHARE_CREATED Audit Event (NO raw tokens or token hashes in audit metadata!)
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.SHARE_CREATED,
      userId: user.userId,
      caseId,
      documentId: version.documentId,
      versionId: version.id,
      action: `Created ${dto.expirationHours}-hour evidence share for recipient '${targetUser.email}'`,
      metadata: {
        shareId: share.id,
        targetUserId: dto.targetUserId,
        expirationHours: dto.expirationHours,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // Return raw token ONCE upon creation
    return {
      shareId: share.id,
      rawToken, // Returned ONCE to creator for transport
      expiresAt: share.expiresAt,
      targetUser: share.targetUser,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        title: version.document.title,
      },
    };
  }

  async getSharesForVersion(versionId: string, user: UserPayload, pagination: ListActiveSharesDto) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { select: { title: true, caseId: true, case: { select: { caseNumber: true, title: true } } } } },
    });

    if (!version) {
      throw new NotFoundException(`Document version '${versionId}' not found`);
    }

    await this.validateCaseAccess(version.document.caseId, user.userId, user.role as RoleName);

    // Pagination defaults and validation via DTO
    const page = pagination?.page ?? 1;
    const size = pagination?.size ?? 20;
    const offset = (page - 1) * size;

    // Total count for pagination metadata
    const total = await this.prisma.evidenceShare.count({ where: { versionId } });
    const totalPages = Math.ceil(total / size);

    const shares = await this.prisma.evidenceShare.findMany({
      where: { versionId },
      take: size,
      skip: offset,
      include: {
        issuedBy: { select: { id: true, email: true, fullName: true, role: true } },
        targetUser: { select: { id: true, email: true, fullName: true, role: true } },
        revokedBy: { select: { id: true, email: true, fullName: true, role: true } },
        case: { select: { caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = shares.map((s) => ({
      id: s.id,
      versionId: s.versionId,
      caseId: s.caseId,
      caseNumber: s.case?.caseNumber,
      caseTitle: s.case?.title,
      evidenceTitle: version.document.title,
      issuedBy: s.issuedBy,
      targetUser: s.targetUser,
      revokedBy: s.revokedBy,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      status: this.deriveEffectiveStatus(s),
      createdAt: s.createdAt,
    }));

    return { items, page, size, total, totalPages };
  }

  /**
   * Revoke Active Evidence Share
   */
  async revokeShare(shareId: string, user: UserPayload) {
    const share = await this.prisma.evidenceShare.findUnique({
      where: { id: shareId },
      include: { version: { include: { document: true } } },
    });

    if (!share) {
      throw new NotFoundException(`Evidence share '${shareId}' not found`);
    }

    // Verify revoker authorization:
    // Issuer: Must be share.issuedById AND currently retain active case access
    // ADMIN: Authorized according to ADMIN case access
    let isAuthorized = false;
    if (user.role === RoleName.ADMIN) {
      isAuthorized = true;
    } else if (share.issuedById === user.userId) {
      try {
        await this.validateCaseAccess(share.caseId, user.userId, user.role as RoleName);
        isAuthorized = true;
      } catch (_) {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException('Access denied: You are not authorized to revoke this share');
    }

    // Idempotent check: If already revoked, return derived status cleanly
    if (share.revokedAt != null || share.status === ShareStatus.REVOKED) {
      return {
        id: share.id,
        status: ShareStatus.REVOKED,
        revokedAt: share.revokedAt,
        message: 'Share is already revoked',
      };
    }

    const revokedAt = new Date();
    const updatedShare = await this.prisma.evidenceShare.update({
      where: { id: shareId },
      data: {
        status: ShareStatus.REVOKED,
        revokedAt,
        revokedById: user.userId,
      },
    });

    // Record SHARE_REVOKED Audit Event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.SHARE_REVOKED,
      userId: user.userId,
      caseId: share.caseId,
      documentId: share.version.documentId,
      versionId: share.versionId,
      action: `Revoked evidence share '${shareId}'`,
      metadata: {
        shareId: share.id,
        revokedById: user.userId,
      },
    });

    return {
      id: updatedShare.id,
      status: ShareStatus.REVOKED,
      revokedAt: updatedShare.revokedAt,
      message: 'Share revoked successfully',
    };
  }

  /**
   * Redeem / Access Shared Evidence (POST /api/v1/shares/access)
   * Enforces all 16 security invariants.
   */
  async accessSharedEvidence(rawToken: string, user: UserPayload) {
    const tokenHash = this.hashToken(rawToken);

    // 1. Lookup Share Record by Token Hash
    const share = await this.prisma.evidenceShare.findUnique({
      where: { tokenHash },
      include: {
        version: { include: { document: true } },
      },
    });

    // Uniform Enumeration-Safe Failure for Unknown Token
    if (!share) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        action: 'Denied evidence share access: Invalid or unknown token',
        metadata: {
          reason: 'UNKNOWN_TOKEN',
        },
      });

      throw new NotFoundException('Invalid or unusable evidence share token');
    }

    const { version, caseId } = share;
    const documentId = version.documentId;
    const versionId = share.versionId;

    // 2. Strict Recipient Binding: authenticatedUser.userId MUST equal share.targetUserId (NO ADMIN BYPASS)
    if (user.userId !== share.targetUserId) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        caseId,
        documentId,
        versionId,
        action: `Denied share access: User '${user.userId}' is not the designated recipient`,
        metadata: {
          shareId: share.id,
          reason: 'UNAUTHORIZED_RECIPIENT',
        },
      });

      throw new NotFoundException('Invalid or unusable evidence share token');
    }

    // 3. Re-Check Account Status
    const recipientUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isActive: true },
    });

    if (!recipientUser || !recipientUser.isActive) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        caseId,
        documentId,
        versionId,
        action: `Denied share access: Recipient account is inactive`,
        metadata: { shareId: share.id, reason: 'INACTIVE_ACCOUNT' },
      });

      throw new NotFoundException('Invalid or unusable evidence share token');
    }

    // 4. Re-Check Recipient Current Case Authorization (CBAC Re-verification)
    if (user.role !== RoleName.ADMIN) {
      const assignment = await this.prisma.caseAssignment.findUnique({
        where: {
          caseId_userId: {
            caseId,
            userId: user.userId,
          },
        },
      });

      if (!assignment) {
        await this.auditChainService.recordEvent({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          userId: user.userId,
          caseId,
          documentId,
          versionId,
          action: `Denied share access: Recipient case assignment was removed`,
          metadata: { shareId: share.id, reason: 'CASE_ACCESS_REMOVED' },
        });

        throw new NotFoundException('Invalid or unusable evidence share token');
      }
    }

    // 5. Verify Revocation
    if (share.revokedAt != null || share.status === ShareStatus.REVOKED) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        caseId,
        documentId,
        versionId,
        action: `Denied share access: Share '${share.id}' is revoked`,
        metadata: { shareId: share.id, reason: 'REVOKED' },
      });

      throw new NotFoundException('Invalid or unusable evidence share token');
    }

    // 6. Verify Expiration
    if (new Date() >= share.expiresAt) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        caseId,
        documentId,
        versionId,
        action: `Denied share access: Share '${share.id}' has expired`,
        metadata: { shareId: share.id, reason: 'EXPIRED' },
      });

      throw new NotFoundException('Invalid or unusable evidence share token');
    }

    // 7. Invoke Authoritative Document Pipeline (Download, Decrypt, Checksum Integrity)
    let downloadResult;
    try {
      downloadResult = await this.documentsService.downloadVersionWithIntegrityCheck(
        documentId,
        versionId,
        user,
      );
    } catch (integrityErr: any) {
      // If integrity check or access fails, record SHARE_ACCESS_DENIED and re-throw (NO SHARE_ACCESSED)
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.SHARE_ACCESS_DENIED,
        userId: user.userId,
        caseId,
        documentId,
        versionId,
        action: `Denied share access: Authoritative download/integrity check failed (${integrityErr.message})`,
        metadata: { shareId: share.id, reason: 'INTEGRITY_FAILED' },
      });

      throw integrityErr;
    }

    // 8. Log SHARE_ACCESSED ONLY AFTER Download & Integrity Verification Succeed
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.SHARE_ACCESSED,
      userId: user.userId,
      caseId,
      documentId,
      versionId,
      action: `Accessed shared evidence version ${version.versionNumber} via share '${share.id}'`,
      metadata: {
        shareId: share.id,
        sha256Hash: downloadResult.sha256Hash,
      },
    });

    return downloadResult;
  }
}
