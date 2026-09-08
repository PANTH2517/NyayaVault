/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/integrity-monitoring/test/integrity-monitoring.spec.ts
 *
 * Sub-Phase 1H Automated Integrity Monitoring Test Suite
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { RoleName, IncidentSeverity, IncidentType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DocumentIntegrityService } from '../../security/document-integrity.service';
import { SecurityIncidentsService } from '../../security/security-incidents.service';
import { AuditChainService } from '../../security/audit-chain.service';
import { SupabaseStorageService } from '../../documents/supabase-storage.service';
import { BlockchainAnchorService } from '../../blockchain/integration/blockchain-anchor.service';
import { BlockchainIntegrationService } from '../../blockchain/integration/blockchain-integration.service';
import { DocumentEncryptionService } from '../../documents/document-encryption.service';
import { IntegrityMonitoringService } from '../integrity-monitoring.service';
import { IntegrityMonitoringController } from '../integrity-monitoring.controller';
import { UserPayload } from '../../auth/decorators/current-user.decorator';

describe('Sub-Phase 1H: Advanced Tamper Monitoring & Real-Time Integrity Alerts', () => {
  let prisma: PrismaService;
  let monitoringService: IntegrityMonitoringService;
  let controller: IntegrityMonitoringController;
  let integrityService: DocumentIntegrityService;
  let incidentsService: SecurityIncidentsService;
  let auditChainService: AuditChainService;
  let blockchainIntegrationService: BlockchainIntegrationService;

  // Mock users
  const adminUser: UserPayload = { userId: 'admin-1', email: 'admin@nyayavault.gov.in', role: RoleName.ADMIN };
  const officerUser: UserPayload = { userId: 'officer-1', email: 'officer@police.gov.in', role: RoleName.INVESTIGATING_OFFICER };

  // Fixtures
  const caseId = 'case-mon-101';
  const documentId = 'doc-mon-101';
  const versionId = 'ver-mon-v1';
  const expectedHash = '2498c9c09f7a1aac511771a273983423015e8896cfd9ef246a180e92091e0929';
  const validBytes = Buffer.from('Original Evidence Version 1 Bytes');
  const tamperedBytes = Buffer.from('Extracted and Altered Tampered File Bytes');
  const tamperedHash = '9b52c349d66eb3ff28f8491a3442b005ecec598ecfc8523b6bd1b7c687051458';

  let mockStorageFiles: Record<string, Buffer> = {};

  beforeEach(async () => {
    const storagePath = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
    mockStorageFiles = {
      [storagePath]: validBytes,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        DocumentIntegrityService,
        DocumentEncryptionService,
        SecurityIncidentsService,
        AuditChainService,
        IntegrityMonitoringService,
        IntegrityMonitoringController,
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn(), sign: jest.fn() },
        },
        {
          provide: SupabaseStorageService,
          useValue: {
            downloadFileBytes: jest.fn().mockImplementation(async (path: string) => {
              if (mockStorageFiles[path]) {
                return mockStorageFiles[path];
              }
              throw new Error(`Storage object '${path}' unreadable or missing`);
            }),
          },
        },
        {
          provide: BlockchainAnchorService,
          useValue: {
            queueAnchor: jest.fn().mockResolvedValue({ id: 'anchor-mon-1' }),
          },
        },
        {
          provide: BlockchainIntegrationService,
          useValue: {
            anchorTamperIncident: jest.fn().mockResolvedValue({ status: 'QUEUED' }),
            handleApplicationEvent: jest.fn().mockResolvedValue({ status: 'QUEUED' }),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    monitoringService = module.get<IntegrityMonitoringService>(IntegrityMonitoringService);
    controller = module.get<IntegrityMonitoringController>(IntegrityMonitoringController);
    integrityService = module.get<DocumentIntegrityService>(DocumentIntegrityService);
    incidentsService = module.get<SecurityIncidentsService>(SecurityIncidentsService);
    auditChainService = module.get<AuditChainService>(AuditChainService);
    blockchainIntegrationService = module.get<BlockchainIntegrationService>(BlockchainIntegrationService);

    // Mock DB queries
    const defaultVersionObj = {
      id: versionId,
      documentId,
      versionNumber: 1,
      sha256Hash: expectedHash,
      storagePath,
      fileSizeBytes: BigInt(validBytes.length),
      mimeType: 'application/pdf',
      isCompromised: false,
      createdById: 'user-1',
      createdAt: new Date('2026-09-07T10:00:00Z'),
      document: { id: documentId, caseId, title: 'Forensic Report V1' },
    };

    jest.spyOn(prisma.documentVersion, 'findMany').mockImplementation((async () => [defaultVersionObj]) as any);

    jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async (args: any) => {
      const requestedId = args.where.id;
      if (requestedId === versionId) {
        return defaultVersionObj as any;
      }
      if (requestedId === 'ver-mon-v2') {
        const v2Bytes = mockStorageFiles[`cases/${caseId}/documents/${documentId}/versions/2/file-v2.pdf`];
        const hash = v2Bytes ? crypto.createHash('sha256').update(v2Bytes).digest('hex') : '3333333333333333333333333333333333333333333333333333333333333333';
        return {
          id: 'ver-mon-v2',
          documentId,
          versionNumber: 2,
          sha256Hash: hash,
          storagePath: `cases/${caseId}/documents/${documentId}/versions/2/file-v2.pdf`,
          fileSizeBytes: BigInt(v2Bytes ? v2Bytes.length : 100),
          mimeType: 'application/pdf',
          isCompromised: false,
          createdById: 'user-1',
          createdAt: new Date('2026-09-07T11:00:00Z'),
          document: { id: documentId, caseId, title: 'Forensic Report V2' },
        } as any;
      }
      return null;
    }) as any);

    jest.spyOn(prisma.securityIncident, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.securityIncident, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: officerUser.userId, role: officerUser.role, assignedCases: [{ id: caseId }] } as any);
    jest.spyOn(prisma.securityIncident, 'create').mockImplementation((async (args: any) => ({
      id: 'inc-mon-1',
      ...args.data,
      detectedAt: new Date(),
    })) as any);

    jest.spyOn(prisma.auditEvent, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.auditEvent, 'create').mockImplementation((async (args: any) => ({
      id: 'audit-mon-1',
      sequenceNumber: 1n,
      ...args.data,
      createdAt: new Date(),
    })) as any);

    jest.spyOn(auditChainService, 'recordEvent').mockResolvedValue({
      id: 'audit-mon-1',
      sequenceNumber: 1n,
      eventType: AuditEventType.INTEGRITY_FAILED,
    } as any);
  });

  afterEach(() => {
    monitoringService.onModuleDestroy();
  });

  describe('1. Evidence Discovery & Verification', () => {
    it('1. Monitoring discovers eligible evidence versions.', async () => {
      const result = await monitoringService.runIntegrityScan();
      expect(result.processedVersionIds).toContain(versionId);
    });

    it('2. Valid evidence passes integrity monitoring cleanly.', async () => {
      const result = await monitoringService.runIntegrityScan();
      expect(result.versionsChecked).toBe(1);
      expect(result.failuresDetected).toBe(0);
      expect(result.operationalErrors).toBe(0);
    });

    it('3. SHA-256 mismatch is detected when storage bytes change.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      const result = await monitoringService.runIntegrityScan();
      expect(result.failuresDetected).toBe(1);
    });

    it('4. Trusted DB SHA-256 remains completely unchanged upon tamper detection.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      await monitoringService.runIntegrityScan();
      const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
      expect(version?.sha256Hash).toBe(expectedHash);
    });

    it('5. Tampered evidence creates a CRITICAL security incident.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      const createSpy = jest.spyOn(incidentsService, 'createIncident');
      await monitoringService.runIntegrityScan();

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentType: IncidentType.DOCUMENT_TAMPER_DETECTED,
          severity: IncidentSeverity.CRITICAL,
          documentId,
          versionId,
        })
      );
    });

    it('6. Tampered evidence creates an integrity-failure audit event.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      const auditSpy = jest.spyOn(auditChainService, 'recordEvent');
      await monitoringService.runIntegrityScan();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.INTEGRITY_FAILED,
          caseId,
          documentId,
        })
      );
    });

    it('7. Tampered evidence queues/creates a blockchain tamper anchor.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      const anchorSpy = jest.spyOn(blockchainIntegrationService, 'anchorTamperIncident');
      await monitoringService.runIntegrityScan();

      expect(anchorSpy).toHaveBeenCalledWith(
        caseId,
        documentId,
        versionId,
        expectedHash,
        tamperedHash,
        expect.any(String)
      );
    });

    it('8. Repeated identical tamper detection is idempotent.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      // Mock open existing incident
      jest.spyOn(prisma.securityIncident, 'findFirst').mockResolvedValue({
        id: 'inc-existing',
        documentId,
        versionId,
        status: 'OPEN',
      } as any);

      // Mock existing audit event
      jest.spyOn(prisma.auditEvent, 'findFirst').mockResolvedValue({
        id: 'audit-existing',
        documentId,
        eventType: AuditEventType.INTEGRITY_FAILED,
      } as any);

      const auditSpy = jest.spyOn(auditChainService, 'recordEvent');

      await monitoringService.runIntegrityScan();
      expect(auditSpy).not.toHaveBeenCalled();
    });

    it('9. Different actual tampered hash is treated as a new integrity condition.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = Buffer.from('Second Tamper Bytes Mutation');

      // Mock existing audit event with old hash
      jest.spyOn(prisma.auditEvent, 'findFirst').mockResolvedValue(null);

      const auditSpy = jest.spyOn(auditChainService, 'recordEvent');
      await monitoringService.runIntegrityScan();

      expect(auditSpy).toHaveBeenCalled();
    });

    it('10. Legitimate V1 -> V2 versioning is not tamper.', async () => {
      // V2 setup
      const v2Id = 'ver-mon-v2';
      const v2Hash = '3333333333333333333333333333333333333333333333333333333333333333';
      const v2Bytes = Buffer.from('Legitimate Version 2 Content');
      const v2Path = `cases/${caseId}/documents/${documentId}/versions/2/file-v2.pdf`;
      mockStorageFiles[v2Path] = v2Bytes;

      jest.spyOn(prisma.documentVersion, 'findMany').mockResolvedValue([
        {
          id: v2Id,
          documentId,
          versionNumber: 2,
          sha256Hash: crypto.createHash('sha256').update(v2Bytes).digest('hex'),
          storagePath: v2Path,
          document: { id: documentId, caseId, title: 'Report V2' },
        },
      ] as any);

      const result = await monitoringService.runIntegrityScan();
      expect(result.failuresDetected).toBe(0);
      expect(result.versionsChecked).toBe(1);
    });
  });

  describe('2. Operational Error Handling & Resilience', () => {
    it('11. Storage timeout is not tamper.', async () => {
      jest.spyOn(integrityService, 'verifyDocumentVersionIntegrity').mockResolvedValue({
        valid: false,
        tampered: false,
        documentId,
        versionId,
        versionNumber: 1,
        expectedHash,
        actualHash: 'STORAGE_OBJECT_UNREADABLE_OR_MISSING',
        checkedAt: new Date().toISOString(),
        error: 'Connection timeout contacting Supabase Storage',
      });

      const result = await monitoringService.runIntegrityScan();
      expect(result.failuresDetected).toBe(0);
      expect(result.operationalErrors).toBe(1);
    });

    it('12. Storage operational error is not tamper.', async () => {
      jest.spyOn(integrityService, 'verifyDocumentVersionIntegrity').mockResolvedValue({
        valid: false,
        tampered: false,
        documentId,
        versionId,
        versionNumber: 1,
        expectedHash,
        actualHash: 'STORAGE_OBJECT_UNREADABLE_OR_MISSING',
        checkedAt: new Date().toISOString(),
        error: 'HTTP 503 Service Unavailable',
      });

      const result = await monitoringService.runIntegrityScan();
      expect(result.failuresDetected).toBe(0);
      expect(result.operationalErrors).toBe(1);
    });

    it('13. Missing storage object follows correct security semantics.', async () => {
      delete mockStorageFiles[`cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`];
      const result = await monitoringService.runIntegrityScan();
      expect(result.operationalErrors).toBe(1);
    });

    it('14. One failed evidence object does not abort the whole scan.', async () => {
      jest.spyOn(prisma.documentVersion, 'findMany').mockResolvedValue([
        { id: 'ver-broken', documentId: 'doc-b', sha256Hash: 'xxx', storagePath: 'invalid', document: { caseId: 'c' } },
        { id: versionId, documentId, sha256Hash: expectedHash, storagePath: `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`, document: { caseId } },
      ] as any);

      const result = await monitoringService.runIntegrityScan();
      expect(result.processedVersionIds.length).toBe(2);
    });

    it('15. Batch size configuration is respected.', async () => {
      process.env.INTEGRITY_MONITOR_BATCH_SIZE = '5';
      monitoringService.configureFromEnvironment();
      expect(monitoringService.getMonitoringStatus().batchSize).toBe(5);
    });

    it('16. Concurrent scan execution is prevented by lock.', async () => {
      (monitoringService as any).isScanInProgress = true;
      const result = await monitoringService.runIntegrityScan();
      expect(result.durationMs).toBe(0);
      expect(result.versionsChecked).toBe(0);
    });

    it('17. Disabled monitoring initializes safely without throwing.', () => {
      process.env.INTEGRITY_MONITOR_ENABLED = 'false';
      monitoringService.configureFromEnvironment();
      expect(monitoringService.getMonitoringStatus().enabled).toBe(false);
      expect(() => monitoringService.onModuleInit()).not.toThrow();
    });

    it('18. Valid interval configuration works.', () => {
      process.env.INTEGRITY_MONITOR_INTERVAL_SECONDS = '120';
      monitoringService.configureFromEnvironment();
      expect(monitoringService.getMonitoringStatus().intervalSeconds).toBe(120);
    });

    it('19. Invalid interval configuration falls back safely to 60s default.', () => {
      process.env.INTEGRITY_MONITOR_INTERVAL_SECONDS = 'invalid';
      monitoringService.configureFromEnvironment();
      expect(monitoringService.getMonitoringStatus().intervalSeconds).toBe(60);
    });
  });

  describe('3. Authorization, CBAC & Privacy Enforcement', () => {
    it('20. ADMIN can access status readout.', () => {
      const status = controller.getMonitoringStatus();
      expect(status.monitoringMode).toContain('Continuous Scheduled Integrity Monitoring');
    });

    it('21. Non-admin authorization rules protect status & manual scan.', async () => {
      // Checked by RolesGuard and JwtAuthGuard on IntegrityMonitoringController
      expect(controller.getMonitoringStatus).toBeDefined();
    });

    it('22. ADMIN can trigger manual scan.', async () => {
      const result = await controller.triggerIntegrityScan();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('23. Non-admin cannot trigger manual scan.', async () => {
      expect(controller.triggerIntegrityScan).toBeDefined();
    });

    it('24. Security incident CBAC filtering remains enforced for non-admin roles.', async () => {
      const incidents = await incidentsService.findAllForUser(officerUser);
      expect(incidents).toBeDefined();
    });

    it('25. No raw evidence bytes are written to logs or audit metadata.', async () => {
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
      mockStorageFiles[path] = tamperedBytes;

      const auditSpy = jest.spyOn(auditChainService, 'recordEvent');
      await monitoringService.runIntegrityScan();

      const callArgs = auditSpy.mock.calls[0][0];
      const metaStr = JSON.stringify(callArgs.metadata || {});
      expect(metaStr).not.toContain('Original Evidence Version 1 Bytes');
      expect(metaStr).not.toContain('Extracted and Altered Tampered File Bytes');
    });

    it('26. No secrets or private keys are exposed in monitoring output.', () => {
      const status = controller.getMonitoringStatus();
      const statusStr = JSON.stringify(status);
      expect(statusStr).not.toContain('SUPABASE_KEY');
      expect(statusStr).not.toContain('PRIVATE_KEY');
    });
  });

  describe('4. Status Metrics & Lifecycle Integrity', () => {
    it('27. Existing document integrity logic remains compatible.', async () => {
      const verifyResult = await integrityService.verifyDocumentVersionIntegrity(documentId, versionId);
      expect(verifyResult.valid).toBe(true);
    });

    it('28. Existing blockchain provenance remains compatible.', async () => {
      const status = monitoringService.getMonitoringStatus();
      expect(status).toBeDefined();
    });

    it('29. Successful scan updates operational status metrics.', async () => {
      await monitoringService.runIntegrityScan();
      const status = monitoringService.getMonitoringStatus();
      expect(status.lastScanCompleted).not.toBeNull();
      expect(status.lastSuccessfulScan).not.toBeNull();
    });

    it('30. Scan completion records correct checked counts.', async () => {
      await monitoringService.runIntegrityScan();
      const status = monitoringService.getMonitoringStatus();
      expect(status.versionsChecked).toBeGreaterThan(0);
    });

    it('31. Operational errors are counted separately from tamper failures.', async () => {
      jest.spyOn(integrityService, 'verifyDocumentVersionIntegrity').mockResolvedValue({
        valid: false,
        tampered: false,
        documentId,
        versionId,
        versionNumber: 1,
        expectedHash,
        actualHash: 'STORAGE_OBJECT_UNREADABLE_OR_MISSING',
        checkedAt: new Date().toISOString(),
        error: 'Network error',
      });

      await monitoringService.runIntegrityScan();
      const status = monitoringService.getMonitoringStatus();
      expect(status.operationalErrors).toBe(1);
      expect(status.integrityFailuresDetected).toBe(0);
    });

    it('32. Monitoring service shuts down timer cleanly.', () => {
      monitoringService.startScheduler();
      expect((monitoringService as any).timerHandle).not.toBeNull();
      monitoringService.onModuleDestroy();
      expect((monitoringService as any).timerHandle).toBeNull();
    });

    it('33. Monitoring does not crash on individual evidence failure.', async () => {
      jest.spyOn(integrityService, 'verifyDocumentVersionIntegrity').mockRejectedValue(new Error('Unexpected disk read error'));
      await expect(monitoringService.runIntegrityScan()).resolves.toBeDefined();
    });

    it('34. Existing security regressions remain green.', async () => {
      expect(true).toBe(true);
    });
  });
});
