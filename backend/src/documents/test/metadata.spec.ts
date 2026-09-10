import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../documents.service';
import { SupabaseStorageService } from '../supabase-storage.service';
import { DocumentEncryptionService } from '../document-encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditChainService } from '../../security/audit-chain.service';
import { DocumentIntegrityService } from '../../security/document-integrity.service';
import { SecurityIncidentsService } from '../../security/security-incidents.service';
import { BlockchainIntegrationService } from '../../blockchain/integration/blockchain-integration.service';
import { RoleName, DocumentClassification, DocumentStatus, AuditEventType } from '@prisma/client';
import { normalizeTags, validateMetadataObject } from '../dto/update-document-metadata.dto';

describe('Phase 1U — Evidence Classification & Metadata Test Suite', () => {
  let documentsService: DocumentsService;
  let auditChainService: AuditChainService;

  // Mock User Identities
  const adminUser = { userId: 'usr-admin-1', email: 'admin@nyayavault.gov.in', role: RoleName.ADMIN };
  const ioUser = { userId: 'usr-io-2', email: 'io.sharma@nyayavault.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const unassignedIoUser = { userId: 'usr-io-99', email: 'io.unassigned@nyayavault.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const supervisorUser = { userId: 'usr-super-3', email: 'super.verma@nyayavault.gov.in', role: RoleName.SUPERVISOR };
  const prosecutorUser = { userId: 'usr-prosecutor-4', email: 'prosecutor.mehta@nyayavault.gov.in', role: RoleName.PROSECUTOR };

  // Mock Case & Documents
  const assignedCaseId = 'case-assigned-101';

  let sampleDoc: any;
  let sealedDoc: any;

  const mockPrismaService = {
    caseAssignment: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const { caseId, userId } = where.caseId_userId;
        if (
          caseId === assignedCaseId &&
          (userId === ioUser.userId || userId === supervisorUser.userId)
        ) {
          return { id: 'asgn-1', caseId, userId };
        }
        return null;
      }),
    },
    document: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === sampleDoc.id) return { ...sampleDoc };
        if (where.id === sealedDoc.id) return { ...sealedDoc };
        return null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const target = where.id === sampleDoc.id ? sampleDoc : sealedDoc;
        Object.assign(target, data);
        return { ...target };
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockAuditChainService = {
    recordEvent: jest.fn().mockResolvedValue({ id: 'aud-1' }),
  };
  const mockStorageService = {};
  const mockEncryptionService = {};
  const mockIntegrityService = {};
  const mockIncidentsService = {};
  const mockBlockchainIntegrationService = {};

  beforeEach(() => {
    jest.clearAllMocks();

    sampleDoc = {
      id: 'doc-uuid-501',
      caseId: assignedCaseId,
      title: 'Original Evidence Title',
      documentType: 'FIR_REPORT',
      classification: DocumentClassification.CONFIDENTIAL,
      description: null,
      exhibitNumber: null,
      tags: [],
      metadata: null,
      currentStatus: DocumentStatus.DRAFT,
      currentVersionId: 'ver-uuid-1',
      createdById: ioUser.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sealedDoc = {
      ...sampleDoc,
      id: 'doc-uuid-sealed',
      currentStatus: DocumentStatus.SEALED,
    };
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditChainService, useValue: mockAuditChainService },
        { provide: SupabaseStorageService, useValue: mockStorageService },
        { provide: DocumentEncryptionService, useValue: mockEncryptionService },
        { provide: DocumentIntegrityService, useValue: mockIntegrityService },
        { provide: SecurityIncidentsService, useValue: mockIncidentsService },
        { provide: BlockchainIntegrationService, useValue: mockBlockchainIntegrationService },
      ],
    }).compile();

    documentsService = module.get<DocumentsService>(DocumentsService);
    auditChainService = module.get<AuditChainService>(AuditChainService);
  });

  it('1. Valid metadata update by assigned INVESTIGATING_OFFICER', async () => {
    const result = await documentsService.updateMetadata(
      sampleDoc.id,
      {
        title: 'Updated FIR Title',
        description: 'Detailed crime report',
        exhibitNumber: 'EX-001',
        tags: ['FIR', 'CYBER'],
      },
      ioUser,
    );

    expect(result.title).toBe('Updated FIR Title');
    expect(result.description).toBe('Detailed crime report');
    expect(result.exhibitNumber).toBe('EX-001');
    expect(result.tags).toEqual(['FIR', 'CYBER']);

    expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.EVIDENCE_METADATA_UPDATED,
        documentId: sampleDoc.id,
      }),
    );
  });

  it('2. Valid metadata update by ADMIN', async () => {
    const result = await documentsService.updateMetadata(
      sampleDoc.id,
      { title: 'Admin Revised Title' },
      adminUser,
    );
    expect(result.title).toBe('Admin Revised Title');
  });

  it('3. Valid metadata update by assigned SUPERVISOR', async () => {
    const result = await documentsService.updateMetadata(
      sampleDoc.id,
      { description: 'Supervisor notes' },
      supervisorUser,
    );
    expect(result.description).toBe('Supervisor notes');
  });

  it('4. INVESTIGATING_OFFICER cannot change classification post-upload (403)', async () => {
    await expect(
      documentsService.updateMetadata(
        sampleDoc.id,
        { classification: DocumentClassification.HIGHLY_CONFIDENTIAL },
        ioUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('5. SUPERVISOR can change classification', async () => {
    const result = await documentsService.updateMetadata(
      sampleDoc.id,
      { classification: DocumentClassification.HIGHLY_CONFIDENTIAL },
      supervisorUser,
    );
    expect(result.classification).toBe(DocumentClassification.HIGHLY_CONFIDENTIAL);
    expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.EVIDENCE_CLASSIFIED,
      }),
    );
  });

  it('6. ADMIN can change classification', async () => {
    const result = await documentsService.updateMetadata(
      sampleDoc.id,
      { classification: DocumentClassification.RESTRICTED },
      adminUser,
    );
    expect(result.classification).toBe(DocumentClassification.RESTRICTED);
  });

  it('7. PROSECUTOR receives 403 Forbidden for metadata update', async () => {
    await expect(
      documentsService.updateMetadata(
        sampleDoc.id,
        { description: 'Prosecutor note' },
        prosecutorUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('8. Unassigned officer receives 403 Forbidden', async () => {
    await expect(
      documentsService.updateMetadata(
        sampleDoc.id,
        { title: 'Unassigned update' },
        unassignedIoUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('9. SEALED document metadata edit fails-closed with exact 403 message', async () => {
    await expect(
      documentsService.updateMetadata(
        sealedDoc.id,
        { title: 'Attempted Sealed Edit' },
        adminUser,
      ),
    ).rejects.toThrow('Cannot modify metadata of SEALED evidence');
  });

  it('10. Audit event records exact previous and updated metadata diffs', async () => {
    await documentsService.updateMetadata(
      sampleDoc.id,
      {
        title: 'New Title',
        exhibitNumber: 'EX-99',
      },
      adminUser,
    );

    expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.EVIDENCE_METADATA_UPDATED,
      userId: adminUser.userId,
      caseId: sampleDoc.caseId,
      documentId: sampleDoc.id,
      versionId: sampleDoc.currentVersionId,
      action: `Updated metadata for evidence 'New Title'`,
      metadata: {
        previous: {
          title: 'Original Evidence Title',
          exhibitNumber: null,
        },
        updated: {
          title: 'New Title',
          exhibitNumber: 'EX-99',
        },
      },
    });
  });

  it('11. Separate EVIDENCE_CLASSIFIED audit event created when classification changes', async () => {
    await documentsService.updateMetadata(
      sampleDoc.id,
      { classification: DocumentClassification.HIGHLY_CONFIDENTIAL },
      adminUser,
    );

    expect(mockAuditChainService.recordEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.EVIDENCE_CLASSIFIED,
      userId: adminUser.userId,
      caseId: sampleDoc.caseId,
      documentId: sampleDoc.id,
      versionId: sampleDoc.currentVersionId,
      action: `Updated classification for evidence 'Original Evidence Title' from CONFIDENTIAL to HIGHLY_CONFIDENTIAL`,
      metadata: {
        previousClassification: DocumentClassification.CONFIDENTIAL,
        newClassification: DocumentClassification.HIGHLY_CONFIDENTIAL,
      },
    });
  });

  it('12. No-op metadata update does not create audit noise', async () => {
    await documentsService.updateMetadata(
      sampleDoc.id,
      { title: sampleDoc.title, classification: sampleDoc.classification },
      adminUser,
    );

    expect(mockAuditChainService.recordEvent).not.toHaveBeenCalled();
  });

  it('13. Tag normalization and validation rules', () => {
    const tags = normalizeTags([' FIR ', 'fir', '  Cyber  ']);
    expect(tags).toEqual(['FIR', 'Cyber']);

    expect(() => normalizeTags(['   '])).toThrow(BadRequestException);

    expect(() => normalizeTags(['A'.repeat(31)])).toThrow(BadRequestException);

    const elevenTags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(() => normalizeTags(elevenTags)).toThrow(BadRequestException);
  });

  it('14. Metadata object size validation rules', () => {
    expect(() => validateMetadataObject('not json')).toThrow(BadRequestException);
    expect(validateMetadataObject({ key: 'val' })).toEqual({ key: 'val' });

    const hugeObj = { data: 'X'.repeat(50001) };
    expect(() => validateMetadataObject(hugeObj)).toThrow(BadRequestException);
  });
});
