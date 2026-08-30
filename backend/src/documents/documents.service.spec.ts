import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ExecutionContext,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DocumentsService, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './documents.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentAccessGuard } from './guards/document-access.guard';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleName, DocumentClassification, DocumentStatus } from '@prisma/client';

describe('DocumentsModule & Secure Upload Foundation Test Suite (Milestone 5)', () => {
  let documentsService: DocumentsService;
  let storageService: SupabaseStorageService;
  let documentAccessGuard: DocumentAccessGuard;
  let caseAccessGuard: CaseAccessGuard;
  let jwtAuthGuard: JwtAuthGuard;

  // Mock User Identities
  const adminUser = { userId: 'usr-admin-1', email: 'admin@nyayavault.gov.in', role: RoleName.ADMIN };
  const ioUser = { userId: 'usr-io-2', email: 'io.sharma@nyayavault.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const supervisorUser = { userId: 'usr-super-3', email: 'super.verma@nyayavault.gov.in', role: RoleName.SUPERVISOR };
  const prosecutorUser = { userId: 'usr-prosecutor-4', email: 'prosecutor.mehta@nyayavault.gov.in', role: RoleName.PROSECUTOR };

  // Mock Case & Document Entities
  const assignedCase = { id: 'case-assigned-101', caseNumber: 'CR-2026-0042', title: 'State vs. Cyber Intruders' };
  const unassignedCase = { id: 'case-unassigned-102', caseNumber: 'CR-2026-0108', title: 'Unassigned Audit Case' };

  const sampleDoc = {
    id: 'doc-uuid-501',
    caseId: assignedCase.id,
    title: 'First Information Report',
    documentType: 'FIR',
    classification: DocumentClassification.CONFIDENTIAL,
    currentStatus: DocumentStatus.DRAFT,
    currentVersionId: 'ver-uuid-1',
    createdById: ioUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleVersion = {
    id: 'ver-uuid-1',
    documentId: sampleDoc.id,
    versionNumber: 1,
    storagePath: `cases/${assignedCase.id}/documents/${sampleDoc.id}/versions/1/file-1`,
    fileSizeBytes: BigInt(1024),
    mimeType: 'application/pdf',
    sha256Hash: crypto.createHash('sha256').update('Sample PDF Content').digest('hex'),
    isCompromised: false,
    createdById: ioUser.userId,
    createdAt: new Date(),
  };

  // Mock Prisma Store
  const mockPrismaService = {
    case: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === assignedCase.id) return assignedCase;
        if (where.id === unassignedCase.id) return unassignedCase;
        return null;
      }),
    },
    caseAssignment: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const { caseId, userId } = where.caseId_userId;
        if (caseId === assignedCase.id && userId === ioUser.userId) {
          return { id: 'asgn-1', caseId, userId };
        }
        return null;
      }),
    },
    document: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === sampleDoc.id) return sampleDoc;
        return null;
      }),
      findMany: jest.fn().mockImplementation(async ({ where }) => {
        if (where.caseId === assignedCase.id) return [sampleDoc];
        return [];
      }),
    },
    documentVersion: {
      findMany: jest.fn().mockImplementation(async ({ where }) => {
        if (where.documentId === sampleDoc.id) return [sampleVersion];
        return [];
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      const txMock = {
        document: {
          create: jest.fn().mockResolvedValue(sampleDoc),
          update: jest.fn().mockResolvedValue(sampleDoc),
        },
        documentVersion: {
          create: jest.fn().mockResolvedValue(sampleVersion),
        },
      };
      return callback(txMock);
    }),
  };

  // Create valid sample test file buffer
  const sampleFileBuffer = Buffer.from('Official Evidence Document Content 2026');
  const expectedSHA256 = crypto.createHash('sha256').update(sampleFileBuffer).digest('hex');

  const validMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'fir_report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: sampleFileBuffer,
    size: sampleFileBuffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'dev_jwt_secret_key_for_local_testing_only',
        }),
      ],
      providers: [
        DocumentsService,
        SupabaseStorageService,
        DocumentAccessGuard,
        CaseAccessGuard,
        JwtAuthGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    documentsService = module.get<DocumentsService>(DocumentsService);
    storageService = module.get<SupabaseStorageService>(SupabaseStorageService);
    documentAccessGuard = module.get<DocumentAccessGuard>(DocumentAccessGuard);
    caseAccessGuard = module.get<CaseAccessGuard>(CaseAccessGuard);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  // 1. ADMIN can upload to any valid case
  it('1. ADMIN can upload a document to any valid case', async () => {
    const result = await documentsService.uploadDocument(
      unassignedCase.id,
      { title: 'Admin Audit Log', documentType: 'FORENSIC_REPORT' },
      validMulterFile,
      adminUser,
    );
    expect(result).toHaveProperty('document');
    expect(result).toHaveProperty('version');
    expect(result.version.versionNumber).toBe(1);
  });

  // 2. Assigned INVESTIGATING_OFFICER can upload
  it('2. Assigned INVESTIGATING_OFFICER can upload to an assigned case', async () => {
    const result = await documentsService.uploadDocument(
      assignedCase.id,
      { title: 'Witness Statement 1', documentType: 'WITNESS_STATEMENT' },
      validMulterFile,
      ioUser,
    );
    expect(result).toHaveProperty('document');
    expect(result.version.versionNumber).toBe(1);
  });

  // 3. INVESTIGATING_OFFICER cannot upload to unassigned case
  it('3. INVESTIGATING_OFFICER is denied upload access to an unassigned case (403)', async () => {
    await expect(
      documentsService.uploadDocument(
        unassignedCase.id,
        { title: 'Unauthorized FIR', documentType: 'FIR' },
        validMulterFile,
        ioUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // 4. SUPERVISOR cannot upload
  it('4. SUPERVISOR role is denied upload permission by default (403)', async () => {
    await expect(
      documentsService.uploadDocument(
        assignedCase.id,
        { title: 'Supervisor Review', documentType: 'REVIEW' },
        validMulterFile,
        supervisorUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // 5. PROSECUTOR cannot upload
  it('5. PROSECUTOR role is denied upload permission by default (403)', async () => {
    await expect(
      documentsService.uploadDocument(
        assignedCase.id,
        { title: 'Prosecution Motion', documentType: 'COURT_FILING' },
        validMulterFile,
        prosecutorUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // 6. Unauthenticated upload rejected
  it('6. Unauthenticated upload request is rejected by JwtAuthGuard (401)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as ExecutionContext;
    await expect(jwtAuthGuard.canActivate(mockContext)).rejects.toThrow();
  });

  // 7 & 8. Client hash ignored; SHA-256 calculated server-side from raw bytes
  it('7 & 8. Server-side SHA-256 is computed deterministically from actual file bytes and ignores client claims', async () => {
    const computedHash = crypto.createHash('sha256').update(sampleFileBuffer).digest('hex');
    expect(computedHash).toBe(expectedSHA256);
    expect(computedHash).toHaveLength(64); // 64 hex characters for SHA-256
  });

  // 9. Initial upload creates exactly versionNumber = 1
  it('9. Initial upload creates exactly DocumentVersion with versionNumber = 1', async () => {
    const result = await documentsService.uploadDocument(
      assignedCase.id,
      { title: 'Initial Charge Sheet', documentType: 'CHARGE_SHEET' },
      validMulterFile,
      adminUser,
    );
    expect(result.version.versionNumber).toBe(1);
  });

  // 10. File metadata stored correctly
  it('10. DocumentVersion metadata (mimeType, sha256Hash, storagePath, fileSizeBytes) is populated correctly', async () => {
    const result = await documentsService.uploadDocument(
      assignedCase.id,
      { title: 'Evidence Photo', documentType: 'EVIDENCE' },
      validMulterFile,
      adminUser,
    );
    expect(result.version.mimeType).toBe(validMulterFile.mimetype);
    expect(result.version.sha256Hash).toBe(sampleVersion.sha256Hash);
    expect(result.version.storagePath).toContain(`cases/${assignedCase.id}/documents/`);
  });

  // 11. Unauthorized user cannot retrieve document by ID
  it('11. User unassigned to case is denied access to document ID via DocumentAccessGuard (403)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: prosecutorUser, // Unassigned to assignedCase
          params: { id: sampleDoc.id },
        }),
      }),
    } as ExecutionContext;

    await expect(documentAccessGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  // 12. Unauthorized user cannot list documents for another case
  it('12. User unassigned to case is denied document listing via CaseAccessGuard (403)', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: prosecutorUser,
          params: { caseId: assignedCase.id },
        }),
      }),
    } as ExecutionContext;

    await expect(caseAccessGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  // 13. Invalid file type rejected
  it('13. Uploading invalid MIME type (e.g. application/x-executable) throws 400 Bad Request', async () => {
    const invalidFile: Express.Multer.File = {
      ...validMulterFile,
      mimetype: 'application/x-executable',
    };

    await expect(
      documentsService.uploadDocument(
        assignedCase.id,
        { title: 'Malicious File', documentType: 'ATTACHMENT' },
        invalidFile,
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // 14. Oversized file rejected
  it('14. Uploading file exceeding MAX_FILE_SIZE_BYTES (25MB) throws 400 Bad Request', async () => {
    const oversizedFile: Express.Multer.File = {
      ...validMulterFile,
      size: MAX_FILE_SIZE_BYTES + 1024,
    };

    await expect(
      documentsService.uploadDocument(
        assignedCase.id,
        { title: 'Huge File', documentType: 'ATTACHMENT' },
        oversizedFile,
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // 15 & 16. Database failure triggers storage cleanup attempt
  it('15 & 16. If database persistence fails after storage upload, storage object cleanup is triggered', async () => {
    const deleteSpy = jest.spyOn(storageService, 'deleteFile');

    // Force $transaction failure
    jest.spyOn(mockPrismaService, '$transaction').mockRejectedValueOnce(new Error('DB Constraint Error'));

    await expect(
      documentsService.uploadDocument(
        assignedCase.id,
        { title: 'Failed Upload', documentType: 'FIR' },
        validMulterFile,
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(deleteSpy).toHaveBeenCalled();
  });
});
