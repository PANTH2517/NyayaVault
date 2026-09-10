import { Test, TestingModule } from '@nestjs/testing';
import { SharesService } from '../shares.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../../documents/documents.service';
import { AuditChainService } from '../../security/audit-chain.service';
import { RoleName, ShareStatus, AuditEventType } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('SharesService (Unit & Security Spec - 28 Scenarios)', () => {
  let service: SharesService;
  let prismaMock: any;
  let documentsServiceMock: any;
  let auditChainServiceMock: any;

  const mockIssuer = {
    userId: 'user-issuer-id',
    email: 'officer@nyayavault.gov.in',
    role: RoleName.INVESTIGATING_OFFICER,
  };

  const mockTarget = {
    id: 'user-target-id',
    email: 'prosecutor@nyayavault.gov.in',
    fullName: 'Prosecutor Target',
    role: RoleName.PROSECUTOR,
    isActive: true,
  };

  const mockAdmin = {
    userId: 'user-admin-id',
    email: 'admin@nyayavault.gov.in',
    role: RoleName.ADMIN,
  };

  const mockVersion = {
    id: 'ver-101',
    documentId: 'doc-101',
    versionNumber: 1,
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    document: {
      id: 'doc-101',
      caseId: 'case-101',
      title: 'Forensic Report',
    },
  };

  beforeEach(async () => {
    prismaMock = {
      documentVersion: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      caseAssignment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      evidenceShare: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    documentsServiceMock = {
      downloadVersionWithIntegrityCheck: jest.fn(),
    };

    auditChainServiceMock = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: AuditChainService, useValue: auditChainServiceMock },
      ],
    }).compile();

    service = module.get<SharesService>(SharesService);
  });

  describe('Share Creation & Security Rules', () => {
    it('1. Authorized assigned issuer can create a share', async () => {
      prismaMock.documentVersion.findUnique.mockResolvedValue(mockVersion);
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-1' });
      prismaMock.user.findUnique.mockResolvedValue(mockTarget);
      prismaMock.evidenceShare.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'share-101',
          ...data,
          targetUser: mockTarget,
          issuedBy: mockIssuer,
        }),
      );

      const result = await service.createShare(
        { versionId: 'ver-101', targetUserId: 'user-target-id', expirationHours: 24 },
        mockIssuer as any,
      );

      expect(result.shareId).toBe('share-101');
      expect(result.rawToken).toHaveLength(64); // 32 bytes hex encoded
      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.SHARE_CREATED }),
      );
    });

    it('2. Unauthorized unassigned issuer cannot create a share', async () => {
      prismaMock.documentVersion.findUnique.mockResolvedValue(mockVersion);
      prismaMock.caseAssignment.findUnique.mockResolvedValue(null); // Not assigned

      await expect(
        service.createShare(
          { versionId: 'ver-101', targetUserId: 'user-target-id', expirationHours: 24 },
          mockIssuer as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. Raw share token is never stored in DB or audit metadata', async () => {
      prismaMock.documentVersion.findUnique.mockResolvedValue(mockVersion);
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-1' });
      prismaMock.user.findUnique.mockResolvedValue(mockTarget);
      prismaMock.evidenceShare.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'share-101',
          ...data,
          targetUser: mockTarget,
          issuedBy: mockIssuer,
        }),
      );

      const result = await service.createShare(
        { versionId: 'ver-101', targetUserId: 'user-target-id', expirationHours: 24 },
        mockIssuer as any,
      );

      // Verify DB creation receives ONLY tokenHash, not rawToken
      const dbCreateCall = prismaMock.evidenceShare.create.mock.calls[0][0];
      expect(dbCreateCall.data.tokenHash).toBeDefined();
      expect(dbCreateCall.data.rawToken).toBeUndefined();

      // Verify Audit Event metadata contains NO token or tokenHash
      const auditCall = auditChainServiceMock.recordEvent.mock.calls[0][0];
      expect(JSON.stringify(auditCall.metadata)).not.toContain(result.rawToken);
      expect(JSON.stringify(auditCall.metadata)).not.toContain(dbCreateCall.data.tokenHash);
    });

    it('6. Raw token is stored only as SHA-256 tokenHash', async () => {
      prismaMock.documentVersion.findUnique.mockResolvedValue(mockVersion);
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-1' });
      prismaMock.user.findUnique.mockResolvedValue(mockTarget);
      prismaMock.evidenceShare.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'share-101', ...data, targetUser: mockTarget, issuedBy: mockIssuer }),
      );

      const result = await service.createShare(
        { versionId: 'ver-101', targetUserId: 'user-target-id', expirationHours: 24 },
        mockIssuer as any,
      );

      const expectedHash = crypto.createHash('sha256').update(result.rawToken).digest('hex');
      const dbCreateCall = prismaMock.evidenceShare.create.mock.calls[0][0];
      expect(dbCreateCall.data.tokenHash).toBe(expectedHash);
    });
  });

  describe('Share Access & Redemption Invariants', () => {
    const validRawToken = 'a'.repeat(64);
    const validTokenHash = crypto.createHash('sha256').update(validRawToken).digest('hex');

    const activeShare = {
      id: 'share-101',
      versionId: 'ver-101',
      caseId: 'case-101',
      issuedById: 'user-issuer-id',
      targetUserId: 'user-target-id',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      revokedAt: null,
      status: ShareStatus.ACTIVE,
      version: mockVersion,
    };

    it('3. Active assigned recipient can access shared evidence before expiration', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      documentsServiceMock.downloadVersionWithIntegrityCheck.mockResolvedValue({
        filename: 'Forensic_Report_v1.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: '1024',
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        buffer: Buffer.from('PDF_BYTES'),
      });

      const result = await service.accessSharedEvidence(validRawToken, {
        userId: 'user-target-id',
        role: RoleName.PROSECUTOR,
      } as any);

      expect(result.buffer.toString()).toBe('PDF_BYTES');
      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.SHARE_ACCESSED }),
      );
    });

    it('7. Wrong recipient cannot retrieve evidence using another users share token', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);

      // Another user attempts redemption
      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'wrong-user-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.SHARE_ACCESS_DENIED }),
      );
    });

    it('8. ADMIN who is not targetUserId cannot redeem another users share token', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);

      // ADMIN attempts redemption on token assigned to mockTarget
      await expect(
        service.accessSharedEvidence(validRawToken, mockAdmin as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.SHARE_ACCESS_DENIED }),
      );
    });

    it('9. Expired share rejects redemption with uniform 404 error', async () => {
      const expiredShare = {
        ...activeShare,
        expiresAt: new Date(Date.now() - 1000), // Expired in past
      };
      prismaMock.evidenceShare.findUnique.mockResolvedValue(expiredShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          metadata: expect.objectContaining({ reason: 'EXPIRED' }),
        }),
      );
    });

    it('10. Revoked share rejects redemption with uniform 404 error', async () => {
      const revokedShare = {
        ...activeShare,
        revokedAt: new Date(),
        status: ShareStatus.REVOKED,
      };
      prismaMock.evidenceShare.findUnique.mockResolvedValue(revokedShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          metadata: expect.objectContaining({ reason: 'REVOKED' }),
        }),
      );
    });

    it('11. Target user whose CaseAssignment was removed is denied access', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue(null); // Assignment removed

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          metadata: expect.objectContaining({ reason: 'CASE_ACCESS_REMOVED' }),
        }),
      );
    });

    it('13. Tampered evidence fails integrity check and does NOT produce SHARE_ACCESSED', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      // downloadVersionWithIntegrityCheck fails due to tamper detection
      documentsServiceMock.downloadVersionWithIntegrityCheck.mockRejectedValue(
        new ForbiddenException('DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED'),
      );

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(ForbiddenException);

      // Ensure SHARE_ACCESSED was NOT emitted
      const calls = auditChainServiceMock.recordEvent.mock.calls;
      const accessedEvents = calls.filter((c: any) => c[0].eventType === AuditEventType.SHARE_ACCESSED);
      expect(accessedEvents).toHaveLength(0);

      // Verify SHARE_ACCESS_DENIED with INTEGRITY_FAILED was logged
      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          metadata: expect.objectContaining({ reason: 'INTEGRITY_FAILED' }),
        }),
      );
    });

    it('23 & 24. Unknown token returns uniform 404 and logs SHARE_ACCESS_DENIED without fabricated entity IDs', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(null); // Unknown token

      await expect(
        service.accessSharedEvidence('unknown_token_value_64_chars_long_12345678901234567890123456789012', {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      const auditCall = auditChainServiceMock.recordEvent.mock.calls[0][0];
      expect(auditCall.eventType).toBe(AuditEventType.SHARE_ACCESS_DENIED);
      expect(auditCall.caseId).toBeUndefined();
      expect(auditCall.documentId).toBeUndefined();
      expect(auditCall.versionId).toBeUndefined();
      expect(auditCall.metadata.reason).toBe('UNKNOWN_TOKEN');
    });

    it('12. Inactive account recipient is rejected upon access attempt', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: false }); // Inactive account

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.SHARE_ACCESS_DENIED,
          metadata: expect.objectContaining({ reason: 'INACTIVE_ACCOUNT' }),
        }),
      );
    });

    it('14. Successful redemption delegates to DocumentsService downloadVersionWithIntegrityCheck', async () => {
      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      documentsServiceMock.downloadVersionWithIntegrityCheck.mockResolvedValue({
        filename: 'Encrypted_Doc.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: '2048',
        sha256Hash: 'decrypted_and_verified_sha256_hash',
        buffer: Buffer.from('DECRYPTED_PLAINTEXT_BYTES'),
      });

      const userPayload = { userId: 'user-target-id', role: RoleName.PROSECUTOR };
      const result = await service.accessSharedEvidence(validRawToken, userPayload as any);

      expect(documentsServiceMock.downloadVersionWithIntegrityCheck).toHaveBeenCalledWith(
        'doc-101',
        'ver-101',
        userPayload,
      );
      expect(result.sha256Hash).toBe('decrypted_and_verified_sha256_hash');
      expect(result.buffer.toString()).toBe('DECRYPTED_PLAINTEXT_BYTES');
    });

    it('20 & 22. Dynamic expiration checks on access without producing redundant SHARE_EXPIRED audit events', async () => {
      const expiredShare = {
        ...activeShare,
        expiresAt: new Date(Date.now() - 5000), // Expired 5 sec ago
      };
      prismaMock.evidenceShare.findUnique.mockResolvedValue(expiredShare);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-target-id', isActive: true });
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-target' });

      await expect(
        service.accessSharedEvidence(validRawToken, {
          userId: 'user-target-id',
          role: RoleName.PROSECUTOR,
        } as any),
      ).rejects.toThrow(NotFoundException);

      // Verify SHARE_ACCESS_DENIED was logged, and NO SHARE_EXPIRED event was generated
      const recordedEvents = auditChainServiceMock.recordEvent.mock.calls.map((c: any) => c[0].eventType);
      expect(recordedEvents).toContain(AuditEventType.SHARE_ACCESS_DENIED);
      expect(recordedEvents).not.toContain(AuditEventType.SHARE_EXPIRED);
    });
  });

  describe('Share Revocation & Eligibility', () => {
    it('18. Share revocation records SHARE_REVOKED in audit chain', async () => {
      const activeShare = {
        id: 'share-101',
        versionId: 'ver-101',
        caseId: 'case-101',
        issuedById: 'user-issuer-id',
        status: ShareStatus.ACTIVE,
        revokedAt: null,
        version: mockVersion,
      };

      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-issuer' });
      prismaMock.evidenceShare.update.mockResolvedValue({
        ...activeShare,
        status: ShareStatus.REVOKED,
        revokedAt: new Date(),
      });

      const result = await service.revokeShare('share-101', mockIssuer as any);
      expect(result.status).toBe(ShareStatus.REVOKED);
      expect(auditChainServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.SHARE_REVOKED }),
      );
    });

    it('19. Share revocation is idempotent', async () => {
      const alreadyRevokedShare = {
        id: 'share-101',
        versionId: 'ver-101',
        caseId: 'case-101',
        issuedById: 'user-issuer-id',
        status: ShareStatus.REVOKED,
        revokedAt: new Date(),
        version: mockVersion,
      };

      prismaMock.evidenceShare.findUnique.mockResolvedValue(alreadyRevokedShare);
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-issuer' });

      const result = await service.revokeShare('share-101', mockIssuer as any);
      expect(result.status).toBe(ShareStatus.REVOKED);
      expect(result.message).toBe('Share is already revoked');
    });

    it('26. Issuer who lost case authorization cannot revoke share', async () => {
      const activeShare = {
        id: 'share-101',
        versionId: 'ver-101',
        caseId: 'case-101',
        issuedById: 'user-issuer-id',
        status: ShareStatus.ACTIVE,
        revokedAt: null,
        version: mockVersion,
      };

      prismaMock.evidenceShare.findUnique.mockResolvedValue(activeShare);
      prismaMock.caseAssignment.findUnique.mockResolvedValue(null); // Issuer assignment removed

      await expect(service.revokeShare('share-101', mockIssuer as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('25. getEligibleRecipientsForCase exposes only active case-assigned users', async () => {
      prismaMock.caseAssignment.findUnique.mockResolvedValue({ id: 'assign-caller' });
      prismaMock.caseAssignment.findMany.mockResolvedValue([
        { user: { id: 'u2', email: 'officer2@nyayavault.gov.in', fullName: 'Officer 2', role: RoleName.INVESTIGATING_OFFICER } },
        { user: { id: 'u3', email: 'prosecutor@nyayavault.gov.in', fullName: 'Prosecutor 1', role: RoleName.PROSECUTOR } },
      ]);

      const recipients = await service.getEligibleRecipientsForCase('case-101', mockIssuer as any);
      expect(recipients).toHaveLength(2);
      expect(recipients[0].id).toBe('u2');
      expect(recipients[1].id).toBe('u3');
    });
  });
});
