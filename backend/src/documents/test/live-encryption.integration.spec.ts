import * as dns from 'dns';
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { PrismaClient, RoleName, DocumentClassification } from '@prisma/client';
import { DocumentsService } from '../documents.service';
import { SupabaseStorageService } from '../supabase-storage.service';
import { DocumentEncryptionService, NYEV_MAGIC } from '../document-encryption.service';
import { DocumentIntegrityService } from '../../security/document-integrity.service';
import { AuditChainService } from '../../security/audit-chain.service';
import { SecurityIncidentsService } from '../../security/security-incidents.service';
import { UserPayload } from '../../auth/decorators/current-user.decorator';
import { ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('REAL Live Storage & PostgreSQL Sub-Phase 1J Evidence Encryption Integration Suite', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let storageService: SupabaseStorageService;
  let encryptionService: DocumentEncryptionService;
  let integrityService: DocumentIntegrityService;
  let auditService: AuditChainService;
  let incidentsService: SecurityIncidentsService;
  let documentsService: DocumentsService;

  let testUser: UserPayload;
  let testUserId: string;
  let testCaseId: string;
  const createdDocumentIds: string[] = [];

  beforeAll(async () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = process.env.DOCUMENT_ENCRYPTION_KEY || 'test_doc_encryption_key_32bytes!!';

    let directUrl = process.env.DIRECT_URL || '';
    if (directUrl) {
      if (!directUrl.includes('sslmode=')) {
        directUrl += (directUrl.includes('?') ? '&' : '?') + 'sslmode=require';
      }
      if (!directUrl.includes('connection_limit=')) {
        directUrl += '&connection_limit=5&connect_timeout=30&pool_timeout=30';
      }
    }
    prisma = new PrismaClient({
      datasources: { db: { url: directUrl } },
    });

    storageService = new SupabaseStorageService();
    encryptionService = new DocumentEncryptionService();
    encryptionService.validateEncryptionKey();

    auditService = new AuditChainService(prisma as any);
    incidentsService = new SecurityIncidentsService(prisma as any);
    integrityService = new DocumentIntegrityService(prisma as any, storageService, encryptionService);

    const mockBlockchain = {
      anchorEvidenceCreation: jest.fn().mockResolvedValue(undefined),
      anchorVersionCreation: jest.fn().mockResolvedValue(undefined),
      anchorTamperIncident: jest.fn().mockResolvedValue(undefined),
    } as any;

    documentsService = new DocumentsService(
      prisma as any,
      storageService,
      auditService,
      integrityService,
      incidentsService,
      mockBlockchain,
      encryptionService,
    );

    // Create unique test user and case
    const email = `enc-test-${crypto.randomUUID()}@nyayavault.internal`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'dummy_hash',
        fullName: 'Encryption Integration Tester',
        role: RoleName.INVESTIGATING_OFFICER,
      },
    });
    testUserId = user.id;

    testUser = {
      userId: user.id,
      email: user.email,
      role: RoleName.INVESTIGATING_OFFICER,
    };

    const caseRecord = await prisma.case.create({
      data: {
        caseNumber: `CAS-ENC-${crypto.randomUUID().slice(0, 8)}`,
        title: 'Encryption Integration Test Case',
        createdById: user.id,
      },
    });
    testCaseId = caseRecord.id;

    await prisma.caseAssignment.create({
      data: {
        caseId: testCaseId,
        userId: testUserId,
        roleInCase: 'PRIMARY_INVESTIGATOR',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      for (const docId of createdDocumentIds) {
        const versions = await prisma.documentVersion.findMany({ where: { documentId: docId } });
        for (const v of versions) {
          await storageService.deleteFile(v.storagePath).catch(() => {});
        }
        await prisma.documentVersion.deleteMany({ where: { documentId: docId } });
        await prisma.document.delete({ where: { id: docId } }).catch(() => {});
      }

      if (testCaseId) {
        await prisma.caseAssignment.deleteMany({ where: { caseId: testCaseId } });
        await prisma.case.delete({ where: { id: testCaseId } }).catch(() => {});
      }

      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }

      await prisma.$disconnect();
    }
  });

  it('TEST A — Normal Encrypted Object: Upload stores NYEV ciphertext, database stores plaintext SHA-256, download decrypts & verifies', async () => {
    const rawContent = 'TOP_SECRET_FORENSIC_EVIDENCE_PLAIN_TEXT_PAYLOAD_101';
    const rawBuffer = Buffer.from(rawContent, 'utf-8');
    const expectedPlaintextHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'forensic_report.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: rawBuffer,
      size: rawBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploadRes = await documentsService.uploadDocument(
      testCaseId,
      { title: 'Forensic Report A', documentType: 'FORENSIC_REPORT', classification: DocumentClassification.CONFIDENTIAL },
      file,
      testUser,
    );

    const docId = uploadRes.document.id;
    const versionId = uploadRes.version.id;
    createdDocumentIds.push(docId);

    // Verify DB Version Metadata
    const dbVer = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    expect(dbVer).not.toBeNull();
    expect(dbVer?.sha256Hash).toBe(expectedPlaintextHash);
    expect(dbVer?.isEncrypted).toBe(true);
    expect(dbVer?.encryptionVersion).toBe(1);
    expect(dbVer?.encryptionKeyVersion).toBe(1);

    // Verify Storage Object contains NYEV binary envelope, not raw plaintext
    const storedBytes = await storageService.downloadFileBytes(dbVer!.storagePath);
    expect(storedBytes.length).toBeGreaterThan(36);
    expect(storedBytes.subarray(0, 4)).toEqual(NYEV_MAGIC);
    expect(storedBytes.toString('utf-8')).not.toContain(rawContent);

    // Perform Authorized Download & Verify Decryption + SHA-256
    const downloadRes = await documentsService.downloadVersionWithIntegrityCheck(docId, versionId, testUser);
    expect(downloadRes.buffer.toString('utf-8')).toBe(rawContent);
    expect(downloadRes.sha256Hash).toBe(expectedPlaintextHash);
  });

  it('TEST B — Ciphertext Modification: Mutating ciphertext bytes triggers GCM tag failure & blocks download (403)', async () => {
    const rawContent = 'SENSITIVE_EVIDENCE_FOR_CIPHERTEXT_MUTATION_TEST';
    const rawBuffer = Buffer.from(rawContent, 'utf-8');

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'evidence_b.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: rawBuffer,
      size: rawBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploadRes = await documentsService.uploadDocument(
      testCaseId,
      { title: 'Evidence B', documentType: 'EVIDENCE', classification: DocumentClassification.CONFIDENTIAL },
      file,
      testUser,
    );

    const docId = uploadRes.document.id;
    const versionId = uploadRes.version.id;
    createdDocumentIds.push(docId);

    const dbVer = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    const storedBytes = await storageService.downloadFileBytes(dbVer!.storagePath);

    // Mutate 1 byte of stored ciphertext (byte 45)
    const tamperedCiphertext = Buffer.from(storedBytes);
    tamperedCiphertext[45] = tamperedCiphertext[45] ^ 0xff;

    await storageService.uploadFile(dbVer!.storagePath, tamperedCiphertext, 'application/pdf');

    // Attempt Download -> Must fail closed with 403 Forbidden
    await expect(documentsService.downloadVersionWithIntegrityCheck(docId, versionId, testUser)).rejects.toThrow(
      ForbiddenException,
    );

    // Verify version marked as compromised
    const updatedVer = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    expect(updatedVer?.isCompromised).toBe(true);
  });

  it('TEST C — Validly Encrypted Altered Plaintext: Valid encryption of DIFFERENT plaintext fails SHA-256 check', async () => {
    const originalContent = 'ORIGINAL_LEGAL_CONTRACT_PLAINTEXT';
    const rawBuffer = Buffer.from(originalContent, 'utf-8');

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'contract.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: rawBuffer,
      size: rawBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploadRes = await documentsService.uploadDocument(
      testCaseId,
      { title: 'Contract C', documentType: 'CONTRACT', classification: DocumentClassification.CONFIDENTIAL },
      file,
      testUser,
    );

    const docId = uploadRes.document.id;
    const versionId = uploadRes.version.id;
    createdDocumentIds.push(docId);

    const dbVer = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    const originalTrustedHash = dbVer!.sha256Hash;

    // Encrypt DIFFERENT altered plaintext legitimately using valid key
    const alteredContent = 'ALTERED_FORGED_CONTRACT_PLAINTEXT_DIFFERENT_HASH';
    const alteredBuffer = Buffer.from(alteredContent, 'utf-8');
    const { encryptedBuffer: forgedStorageBytes } = encryptionService.encryptDocumentBytes(alteredBuffer);

    // Replace stored object with forged validly encrypted payload
    await storageService.uploadFile(dbVer!.storagePath, forgedStorageBytes, 'application/pdf');

    // Attempt Download -> Decryption succeeds, but SHA-256 check fails -> 403 Forbidden
    await expect(documentsService.downloadVersionWithIntegrityCheck(docId, versionId, testUser)).rejects.toThrow(
      ForbiddenException,
    );

    // Verify DB trusted hash remained unchanged
    const finalVer = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    expect(finalVer?.sha256Hash).toBe(originalTrustedHash);
    expect(finalVer?.isCompromised).toBe(true);
  });

  it('TEST D — Legacy Document: Controlled legacy unencrypted plaintext version remains readable', async () => {
    const legacyContent = 'UNENCRYPTED_HISTORICAL_LEGACY_DOCUMENT_BYTES_2025';
    const legacyBuffer = Buffer.from(legacyContent, 'utf-8');
    const legacyHash = crypto.createHash('sha256').update(legacyBuffer).digest('hex');

    const doc = await prisma.document.create({
      data: {
        caseId: testCaseId,
        title: 'Legacy Doc D',
        documentType: 'HISTORICAL',
        createdById: testUserId,
      },
    });
    createdDocumentIds.push(doc.id);

    const storagePath = `cases/${testCaseId}/documents/${doc.id}/versions/1/legacy_file.pdf`;
    await storageService.uploadFile(storagePath, legacyBuffer, 'application/pdf');

    const legacyVer = await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        storagePath,
        fileSizeBytes: BigInt(legacyBuffer.length),
        mimeType: 'application/pdf',
        sha256Hash: legacyHash,
        isEncrypted: false,
        createdById: testUserId,
      },
    });

    await prisma.document.update({
      where: { id: doc.id },
      data: { currentVersionId: legacyVer.id },
    });

    // Download Legacy Version -> Decrypts gracefully as legacy plaintext
    const downloadRes = await documentsService.downloadVersionWithIntegrityCheck(doc.id, legacyVer.id, testUser);
    expect(downloadRes.buffer.toString('utf-8')).toBe(legacyContent);
    expect(downloadRes.sha256Hash).toBe(legacyHash);
  });
});
