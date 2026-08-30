import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ForbiddenException, NotFoundException, ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditChainService, GENESIS_HASH } from './audit-chain.service';
import { DocumentIntegrityService } from './document-integrity.service';
import { SecurityIncidentsService } from './security-incidents.service';
import { DocumentsService } from '../documents/documents.service';
import { SupabaseStorageService } from '../documents/supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentAccessGuard } from '../documents/guards/document-access.guard';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';
import { Reflector } from '@nestjs/core';
import {
  RoleName,
  DocumentClassification,
  DocumentStatus,
  AuditEventType,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '@prisma/client';

describe('SecurityModule & Milestone 6 Core Test Suite', () => {
  let auditChainService: AuditChainService;
  let integrityService: DocumentIntegrityService;
  let incidentsService: SecurityIncidentsService;
  let documentsService: DocumentsService;
  let storageService: SupabaseStorageService;
  let rolesGuard: RolesGuard;

  // Mock User Identities
  const adminUser = { userId: 'usr-admin-1', email: 'admin@nyayavault.gov.in', role: RoleName.ADMIN };
  const ioUser = { userId: 'usr-io-2', email: 'io.sharma@nyayavault.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const unassignedIoUser = { userId: 'usr-io-99', email: 'io.other@nyayavault.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const supervisorUser = { userId: 'usr-super-3', email: 'super.verma@nyayavault.gov.in', role: RoleName.SUPERVISOR };
  const prosecutorUser = { userId: 'usr-prosecutor-4', email: 'prosecutor.mehta@nyayavault.gov.in', role: RoleName.PROSECUTOR };

  // In-Memory Data Stores for Mocking Prisma
  const caseRecord = { id: 'case-security-101', caseNumber: 'CR-2026-9999', title: 'Cyber Intrusion Investigation' };

  let documentsStore: any[] = [];
  let versionsStore: any[] = [];
  let auditEventsStore: any[] = [];
  let incidentsStore: any[] = [];

  const sampleV1Buffer = Buffer.from('Original Document V1 Bytes');
  const sampleV1Hash = crypto.createHash('sha256').update(sampleV1Buffer).digest('hex');

  const sampleV2Buffer = Buffer.from('Revised Document V2 Content Bytes');
  const sampleV2Hash = crypto.createHash('sha256').update(sampleV2Buffer).digest('hex');

  const doc1 = {
    id: 'doc-sec-001',
    caseId: caseRecord.id,
    title: 'Forensic Memory Dump',
    documentType: 'FORENSIC_REPORT',
    classification: DocumentClassification.CONFIDENTIAL,
    currentStatus: DocumentStatus.DRAFT,
    currentVersionId: 'ver-sec-v1',
    createdById: ioUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    case: caseRecord,
  };

  const ver1 = {
    id: 'ver-sec-v1',
    documentId: doc1.id,
    versionNumber: 1,
    storagePath: `cases/${caseRecord.id}/documents/${doc1.id}/versions/1/file-v1`,
    fileSizeBytes: BigInt(sampleV1Buffer.length),
    mimeType: 'text/plain',
    sha256Hash: sampleV1Hash,
    isCompromised: false,
    createdById: ioUser.userId,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    case: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === caseRecord.id) return caseRecord;
        return null;
      }),
    },
    caseAssignment: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const { caseId, userId } = where.caseId_userId;
        if (caseId === caseRecord.id && userId === ioUser.userId) {
          return { id: 'asgn-1', caseId, userId };
        }
        return null;
      }),
    },
    document: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        return documentsStore.find((d) => d.id === where.id) || null;
      }),
      findMany: jest.fn().mockImplementation(async () => documentsStore),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const newDoc = { ...data, case: caseRecord, createdAt: new Date(), updatedAt: new Date() };
        documentsStore.push(newDoc);
        return newDoc;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const index = documentsStore.findIndex((d) => d.id === where.id);
        if (index !== -1) {
          documentsStore[index] = { ...documentsStore[index], ...data };
          return documentsStore[index];
        }
        return null;
      }),
    },
    documentVersion: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        return versionsStore.find((v) => v.id === where.id) || null;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where, orderBy }) => {
        const filtered = versionsStore.filter((v) => v.documentId === where.documentId);
        if (orderBy?.versionNumber === 'desc') {
          filtered.sort((a, b) => b.versionNumber - a.versionNumber);
        }
        return filtered[0] || null;
      }),
      findMany: jest.fn().mockImplementation(async ({ where }) => {
        return versionsStore.filter((v) => v.documentId === where.documentId);
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const newVer = { id: `ver-${Date.now()}-${Math.random()}`, ...data, createdAt: new Date() };
        versionsStore.push(newVer);
        return newVer;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const index = versionsStore.findIndex((v) => v.id === where.id);
        if (index !== -1) {
          versionsStore[index] = { ...versionsStore[index], ...data };
          return versionsStore[index];
        }
        return null;
      }),
    },
    auditEvent: {
      findFirst: jest.fn().mockImplementation(async () => {
        if (auditEventsStore.length === 0) return null;
        return auditEventsStore[auditEventsStore.length - 1];
      }),
      findMany: jest.fn().mockImplementation(async () => auditEventsStore),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const nextSeq = BigInt(auditEventsStore.length + 1);
        const event = { id: `aud-${Date.now()}`, sequenceNumber: nextSeq, ...data, createdAt: new Date() };
        auditEventsStore.push(event);
        return event;
      }),
    },
    securityIncident: {
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        return incidentsStore.find(
          (i) =>
            i.incidentType === where.incidentType &&
            (where.documentId ? i.documentId === where.documentId : true) &&
            (where.versionId ? i.versionId === where.versionId : true) &&
            (where.status?.in ? where.status.in.includes(i.status) : i.status === where.status)
        ) || null;
      }),
      findMany: jest.fn().mockImplementation(async () => incidentsStore),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        return incidentsStore.find((i) => i.id === where.id) || null;
      }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const inc = { id: `inc-${Date.now()}`, ...data, detectedAt: new Date(), resolvedAt: null };
        incidentsStore.push(inc);
        return inc;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const index = incidentsStore.findIndex((i) => i.id === where.id);
        if (index !== -1) {
          incidentsStore[index] = { ...incidentsStore[index], ...data };
          return incidentsStore[index];
        }
        return null;
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockPrismaService);
    }),
  };

  beforeEach(() => {
    // Reset stores before each test
    documentsStore = [{ ...doc1 }];
    versionsStore = [{ ...ver1 }];
    auditEventsStore = [];
    incidentsStore = [];
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'dev_jwt_secret_key_for_local_testing_only' }),
      ],
      providers: [
        AuditChainService,
        DocumentIntegrityService,
        SecurityIncidentsService,
        DocumentsService,
        SupabaseStorageService,
        DocumentAccessGuard,
        CaseAccessGuard,
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    auditChainService = module.get<AuditChainService>(AuditChainService);
    integrityService = module.get<DocumentIntegrityService>(DocumentIntegrityService);
    incidentsService = module.get<SecurityIncidentsService>(SecurityIncidentsService);
    documentsService = module.get<DocumentsService>(DocumentsService);
    storageService = module.get<SupabaseStorageService>(SupabaseStorageService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);

    // Seed mock storage with sample v1 file
    await storageService.uploadFile(ver1.storagePath, sampleV1Buffer, 'text/plain');
  });

  // ========================================================
  // PART 1 — IMMUTABLE VERSIONING
  // ========================================================

  it('1. Authorized ADMIN can create document revision v2', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    const res = await documentsService.createVersion(doc1.id, 'Updated forensic notes', file, adminUser);
    expect(res.version.versionNumber).toBe(2);
    expect(res.version.sha256Hash).toBe(sampleV2Hash);
  });

  it('2. Assigned INVESTIGATING_OFFICER can create document revision v2', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    const res = await documentsService.createVersion(doc1.id, 'IO Revision Notes', file, ioUser);
    expect(res.version.versionNumber).toBe(2);
  });

  it('3. Unassigned INVESTIGATING_OFFICER receives 403 Forbidden on revision creation', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    await expect(documentsService.createVersion(doc1.id, 'Unauthorized', file, unassignedIoUser)).rejects.toThrow(ForbiddenException);
  });

  it('4. SUPERVISOR receives 403 Forbidden for document revision creation', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    await expect(documentsService.createVersion(doc1.id, 'Super Revision', file, supervisorUser)).rejects.toThrow(ForbiddenException);
  });

  it('5. PROSECUTOR receives 403 Forbidden for document revision creation', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    await expect(documentsService.createVersion(doc1.id, 'Prosecutor Revision', file, prosecutorUser)).rejects.toThrow(ForbiddenException);
  });

  it('6 & 9. Existing v1 remains unchanged and version numbers increment sequentially', async () => {
    const initialV1 = { ...ver1 };
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    await documentsService.createVersion(doc1.id, 'Revision 2', file, adminUser);
    const versions = await documentsService.findVersionsForDocument(doc1.id);

    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].sha256Hash).toBe(initialV1.sha256Hash); // Unchanged
    expect(versions[1].versionNumber).toBe(2);
  });

  it('7 & 8. Revision v2 receives distinct SHA-256 hash and new storage path', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    const res = await documentsService.createVersion(doc1.id, 'V2 Hash Check', file, adminUser);
    expect(res.version.sha256Hash).not.toEqual(ver1.sha256Hash);
    expect(res.version.storagePath).toContain(`/versions/2/`);
  });

  it('10. Document.currentVersionId points to newest version after revision creation', async () => {
    const file: Express.Multer.File = {
      fieldname: 'file', originalname: 'v2.txt', encoding: '7bit', mimetype: 'text/plain',
      buffer: sampleV2Buffer, size: sampleV2Buffer.length, stream: null as any, destination: '', filename: '', path: '',
    };

    const res = await documentsService.createVersion(doc1.id, 'Current Version Check', file, adminUser);
    const updatedDoc = documentsStore.find((d) => d.id === doc1.id);
    expect(updatedDoc.currentVersionId).toBe(res.version.id);
  });

  // ========================================================
  // PART 2 — BYTE-LEVEL INTEGRITY VERIFICATION & TAMPER DETECTION
  // ========================================================

  it('12 & 17. Untampered file passes SHA-256 verification and allows document access', async () => {
    const res = await documentsService.downloadVersionWithIntegrityCheck(doc1.id, ver1.id, adminUser);
    expect(res.sha256Hash).toBe(ver1.sha256Hash);
    expect(res.buffer.toString()).toBe(sampleV1Buffer.toString());
  });

  it('13, 16, 18, 19. Modified storage bytes fail verification, block download, and create CRITICAL OPEN incident', async () => {
    // Simulate byte tampering in storage
    const tamperedBuffer = Buffer.from('TAMPERED UNAUTHORIZED MALICIOUS BYTES');
    storageService.mutateMockFileBytes(ver1.storagePath, tamperedBuffer);

    // Attempt access must throw ForbiddenException
    await expect(
      documentsService.downloadVersionWithIntegrityCheck(doc1.id, ver1.id, adminUser),
    ).rejects.toThrow('DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED');

    // Verify CRITICAL OPEN incident created automatically
    const incidents = incidentsStore.filter((i) => i.documentId === doc1.id);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].incidentType).toBe(IncidentType.DOCUMENT_TAMPER_DETECTED);
    expect(incidents[0].severity).toBe(IncidentSeverity.CRITICAL);
    expect(incidents[0].status).toBe(IncidentStatus.OPEN);

    // Restore original mock bytes
    storageService.mutateMockFileBytes(ver1.storagePath, sampleV1Buffer);
  });

  it('20 & 21. Repeated access to tampered document deduplicates OPEN incidents but appends audit events', async () => {
    const tamperedBuffer = Buffer.from('TAMPERED BYTES AGAIN');
    storageService.mutateMockFileBytes(ver1.storagePath, tamperedBuffer);

    // Access attempt 1
    await expect(documentsService.downloadVersionWithIntegrityCheck(doc1.id, ver1.id, adminUser)).rejects.toThrow();
    const countFirst = incidentsStore.length;

    // Access attempt 2
    await expect(documentsService.downloadVersionWithIntegrityCheck(doc1.id, ver1.id, adminUser)).rejects.toThrow();
    const countSecond = incidentsStore.length;

    // Incident count stays deduplicated
    expect(countSecond).toBe(countFirst);

    // Audit trail records both failures
    const auditFailures = auditEventsStore.filter((a) => a.eventType === AuditEventType.INTEGRITY_FAILED);
    expect(auditFailures.length).toBeGreaterThanOrEqual(2);

    // Restore mock bytes
    storageService.mutateMockFileBytes(ver1.storagePath, sampleV1Buffer);
  });

  // ========================================================
  // PART 3 — HASH-CHAINED AUDIT TRAIL & VERIFICATION
  // ========================================================

  it('22. First audit event initializes chain correctly referencing GENESIS_HASH', async () => {
    const event = await auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId: adminUser.userId,
      action: 'Admin Login',
    });

    expect(event.previousEventHash).toBe(GENESIS_HASH);
    expect(event.currentEventHash).toHaveLength(64);
  });

  it('23 & 24. Subsequent events reference previousEventHash and valid chain verifies cleanly', async () => {
    await auditChainService.recordEvent({ eventType: AuditEventType.LOGIN, userId: adminUser.userId, action: 'Event 1' });
    await auditChainService.recordEvent({ eventType: AuditEventType.CASE_ACCESS_GRANTED, userId: ioUser.userId, action: 'Event 2' });

    expect(auditEventsStore[1].previousEventHash).toBe(auditEventsStore[0].currentEventHash);

    const verification = await auditChainService.verifyChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalEvents).toBe(2);
  });

  it('25 & 26. Modifying past audit event content or hash breaks chain verification', async () => {
    await auditChainService.recordEvent({ eventType: AuditEventType.LOGIN, userId: adminUser.userId, action: 'Event 1' });
    await auditChainService.recordEvent({ eventType: AuditEventType.DOCUMENT_VIEWED, userId: ioUser.userId, action: 'Event 2' });

    // Tamper with event 0 action content
    auditEventsStore[0].action = 'TAMPERED ACTION CONTENT';

    const verification = await auditChainService.verifyChain();
    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe('CANONICAL_HASH_MISMATCH');
  });

  it('27 & 28. Broken previous hash fails verification and records AUDIT_CHAIN_VERIFICATION_FAILED incident without recursion', async () => {
    await auditChainService.recordEvent({ eventType: AuditEventType.LOGIN, userId: adminUser.userId, action: 'Event 1' });
    await auditChainService.recordEvent({ eventType: AuditEventType.DOCUMENT_VIEWED, userId: ioUser.userId, action: 'Event 2' });

    // Break previous hash link
    auditEventsStore[1].previousEventHash = 'bad0000000000000000000000000000000000000000000000000000000000000';

    const verification = await auditChainService.verifyChain();
    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe('PREVIOUS_HASH_MISMATCH');

    const incident = incidentsStore.find((i) => i.incidentType === IncidentType.AUDIT_CHAIN_VERIFICATION_FAILED);
    expect(incident).toBeDefined();
    expect(incident.severity).toBe(IncidentSeverity.CRITICAL);
  });

  // ========================================================
  // PART 4 — AUTHORIZATION & SECURITY INCIDENTS MANAGEMENT
  // ========================================================

  it('31 & 32. Only ADMIN can perform audit chain verification (RolesGuard check)', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.ADMIN]);
    const guard = new RolesGuard(reflector);

    const adminCtx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: adminUser }) }) } as ExecutionContext;
    expect(guard.canActivate(adminCtx)).toBe(true);

    const ioCtx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: ioUser }) }) } as ExecutionContext;
    expect(() => guard.canActivate(ioCtx)).toThrow(ForbiddenException);
  });

  it('Incidents listing filters correctly for ADMIN vs Non-Admin', async () => {
    await incidentsService.createIncident({
      incidentType: IncidentType.SUSPICIOUS_DOCUMENT_ACTION,
      description: 'Suspicious attempt',
      caseId: caseRecord.id,
    });

    const adminList = await incidentsService.findAllForUser(adminUser);
    expect(adminList.length).toBeGreaterThanOrEqual(1);

    const ioList = await incidentsService.findAllForUser(ioUser);
    expect(ioList.length).toBeGreaterThanOrEqual(1); // ioUser assigned to caseRecord

    const unassignedList = await incidentsService.findAllForUser(unassignedIoUser);
    expect(unassignedList).toHaveLength(0); // unassigned receive empty list
  });
});
