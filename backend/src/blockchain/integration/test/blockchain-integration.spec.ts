import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainEventMapper } from '../blockchain-event-mapper';
import { BlockchainTransactionBuilder } from '../blockchain-transaction-builder';
import { BlockchainAnchorService } from '../blockchain-anchor.service';
import { BlockchainVerificationService } from '../blockchain-verification.service';
import { AuditCheckpointService } from '../audit-checkpoint.service';
import { BlockchainIntegrationService } from '../blockchain-integration.service';
import { BlockchainAnchorStatus, RoleName } from '@prisma/client';
import { computeBlockHash } from '../../ledger/block';
import { buildMerkleTree } from '../../ledger/merkle';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { signTransaction, createLedgerTransaction } from '../../ledger/transaction';
import * as crypto from 'crypto';

describe('Sub-Phase 1F — Blockchain Integration & Application Anchoring', () => {
  let module: TestingModule;
  let eventMapper: BlockchainEventMapper;
  let txBuilder: BlockchainTransactionBuilder;
  let anchorService: BlockchainAnchorService;
  let verificationService: BlockchainVerificationService;
  let checkpointService: AuditCheckpointService;
  let integrationService: BlockchainIntegrationService;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Initialize standard test module with mock PrismaService
    const mockPrisma = {
      blockchainApplicationAnchor: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'anchor-uuid-1',
            status: BlockchainAnchorStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          }),
        ),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            status: args.data.status,
            blockchainTxId: args.data.blockchainTxId,
            blockHash: args.data.blockHash,
            blockHeight: args.data.blockHeight,
            confirmedAt: args.data.confirmedAt,
            failureReason: args.data.failureReason,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditEvent: {
        findFirst: jest.fn().mockResolvedValue({
          sequenceNumber: BigInt(100),
          currentEventHash: crypto.createHash('sha256').update('audit-event-100').digest('hex'),
          eventType: 'DOCUMENT_UPLOADED',
          action: 'Uploaded Document',
          createdAt: new Date(),
        }),
      },
      documentVersion: {
        findUnique: jest.fn(),
      },
      blockchainBlock: {
        findUnique: jest.fn(),
      },
    };

    module = await Test.createTestingModule({
      providers: [
        BlockchainEventMapper,
        BlockchainTransactionBuilder,
        BlockchainAnchorService,
        BlockchainVerificationService,
        AuditCheckpointService,
        BlockchainIntegrationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    eventMapper = module.get<BlockchainEventMapper>(BlockchainEventMapper);
    txBuilder = module.get<BlockchainTransactionBuilder>(BlockchainTransactionBuilder);
    anchorService = module.get<BlockchainAnchorService>(BlockchainAnchorService);
    verificationService = module.get<BlockchainVerificationService>(BlockchainVerificationService);
    checkpointService = module.get<AuditCheckpointService>(AuditCheckpointService);
    integrationService = module.get<BlockchainIntegrationService>(BlockchainIntegrationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('1. Role -> Node & Event -> Policy Mapping', () => {
    it('should map existing four NyayaVault roles to blockchain node identities', () => {
      expect(eventMapper.mapRoleToNodeId(RoleName.ADMIN)).toBe('ADMIN_NODE');
      expect(eventMapper.mapRoleToNodeId(RoleName.INVESTIGATING_OFFICER)).toBe('POLICE_NODE');
      expect(eventMapper.mapRoleToNodeId(RoleName.PROSECUTOR)).toBe('PROSECUTION_NODE');
      expect(eventMapper.mapRoleToNodeId(RoleName.SUPERVISOR)).toBe('COURT_NODE');
    });

    it('should fall back to POLICE_NODE for unmapped or undefined roles', () => {
      expect(eventMapper.mapRoleToNodeId(undefined)).toBe('POLICE_NODE');
    });

    it('should map application events to correct PoA consensus policies', () => {
      expect(eventMapper.mapEventToPolicyId('EVIDENCE_CREATED')).toBe('STANDARD_ANCHOR');
      expect(eventMapper.mapEventToPolicyId('EVIDENCE_VERSION_CREATED')).toBe('STANDARD_ANCHOR');
      expect(eventMapper.mapEventToPolicyId('EVIDENCE_APPROVED')).toBe('STANDARD_ANCHOR');
      expect(eventMapper.mapEventToPolicyId('INTEGRITY_TAMPER_DETECTED')).toBe('STANDARD_ANCHOR');
      expect(eventMapper.mapEventToPolicyId('EVIDENCE_SEALED')).toBe('SEALED_EVIDENCE');
      expect(eventMapper.mapEventToPolicyId('AUDIT_CHECKPOINT')).toBe('GOVERNANCE_CHECKPOINT');
    });

    it('should compute deterministic idempotency keys for logically identical events', () => {
      const key1 = eventMapper.computeIdempotencyKey({
        eventType: 'EVIDENCE_CREATED',
        caseId: 'case-100',
        documentId: 'doc-100',
        versionId: 'ver-1',
        evidenceHash: 'hash-1',
      });
      const key2 = eventMapper.computeIdempotencyKey({
        eventType: 'EVIDENCE_CREATED',
        caseId: 'case-100',
        documentId: 'doc-100',
        versionId: 'ver-1',
        evidenceHash: 'hash-1',
      });
      const key3 = eventMapper.computeIdempotencyKey({
        eventType: 'EVIDENCE_CREATED',
        caseId: 'case-100',
        documentId: 'doc-100',
        versionId: 'ver-2',
        evidenceHash: 'hash-2',
      });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });
  });

  describe('2. Privacy-Preserving Transaction Payloads', () => {
    it('should construct canonical ledger transactions with references and metadata only', () => {
      const evidenceHash = crypto.createHash('sha256').update('sample evidence bytes').digest('hex');
      const tx = txBuilder.buildTransaction(
        {
          eventType: 'EVIDENCE_CREATED',
          role: RoleName.INVESTIGATING_OFFICER,
          caseId: 'case-99',
          documentId: 'doc-1',
          versionId: 'ver-1',
          evidenceHash,
        },
        'POLICE_NODE',
        1,
      );

      expect(tx.originatingNode).toBe('POLICE_NODE');
      expect(tx.payload.eventType).toBe('EVIDENCE_CREATED');
      expect(tx.payload.evidenceHash).toBe(evidenceHash);
    });

    it('should NOT contain sensitive secrets or raw file bytes in JSON serialization', () => {
      const evidenceBytes = Buffer.from('TOP SECRET EVIDENCE FILE CONTENTS');
      const evidenceHash = crypto.createHash('sha256').update(evidenceBytes).digest('hex');

      const tx = txBuilder.buildTransaction(
        {
          eventType: 'EVIDENCE_CREATED',
          role: RoleName.INVESTIGATING_OFFICER,
          caseId: 'case-99',
          documentId: 'doc-1',
          versionId: 'ver-1',
          evidenceHash,
        },
        'POLICE_NODE',
        1,
      );

      const serialized = JSON.stringify(tx.payload);

      expect(serialized).not.toContain('TOP SECRET');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('jwt');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain(evidenceBytes.toString('utf-8'));
    });
  });

  describe('3. Application Anchor Lifecycle & Idempotency', () => {
    it('should prevent duplicate anchor creation when idempotencyKey exists', async () => {
      const existingAnchor = {
        id: 'existing-anchor-1',
        idempotencyKey: 'idemp-123',
        status: BlockchainAnchorStatus.CONFIRMED,
        blockchainTxId: 'tx-123',
        blockHash: 'block-123',
        blockHeight: BigInt(5),
        confirmedAt: new Date(),
      };

      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(
        existingAnchor,
      );

      const res = await anchorService.submitAnchorIntent({
        eventType: 'EVIDENCE_CREATED',
        role: RoleName.INVESTIGATING_OFFICER,
        caseId: 'case-1',
        documentId: 'doc-1',
        versionId: 'ver-1',
        evidenceHash: crypto.createHash('sha256').update('test').digest('hex'),
      });

      expect(res.anchorId).toBe('existing-anchor-1');
      expect(res.status).toBe(BlockchainAnchorStatus.CONFIRMED);
      expect(res.isDuplicate).toBe(true);
      expect(prisma.blockchainApplicationAnchor.create).not.toHaveBeenCalled();
    });

    it('should transition anchor state PENDING -> SUBMITTED -> CONFIRMED upon block commit', async () => {
      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const intentPromise = anchorService.submitAnchorIntent({
        eventType: 'EVIDENCE_CREATED',
        role: RoleName.INVESTIGATING_OFFICER,
        caseId: 'case-1',
        documentId: 'doc-1',
        versionId: 'ver-1',
        evidenceHash: crypto.createHash('sha256').update('test').digest('hex'),
      });

      const anchorRes = await intentPromise;

      expect(anchorRes.anchorId).toBe('anchor-uuid-1');
      expect(prisma.blockchainApplicationAnchor.create).toHaveBeenCalled();

      // Allow background block generation setImmediate to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prisma.blockchainApplicationAnchor.update).toHaveBeenCalled();
    });
  });

  describe('4. Independent Blockchain Verification Engine', () => {
    it('should return NOT_ANCHORED when version has no anchor in database', async () => {
      (prisma.documentVersion.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'non-existent-ver',
        sha256Hash: 'hash-test',
        documentId: 'doc-1',
        document: { caseId: 'case-1' },
      });
      (prisma.blockchainApplicationAnchor.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await verificationService.verifyEvidenceVersion('non-existent-ver');

      expect(result.status).toBe('NOT_ANCHORED');
      expect(result.blockchainAnchorStatus).toBeUndefined();
    });

    it('should return PENDING when anchor is in PENDING state', async () => {
      (prisma.documentVersion.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ver-pending',
        sha256Hash: 'hash-pending',
        documentId: 'doc-1',
        document: { caseId: 'case-1' },
      });
      (prisma.blockchainApplicationAnchor.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'anc-1',
        versionId: 'ver-pending',
        status: BlockchainAnchorStatus.PENDING,
        eventType: 'EVIDENCE_CREATED',
        idempotencyKey: 'idemp-pending',
        evidenceHash: 'hash-pending',
      });

      const result = await verificationService.verifyEvidenceVersion('ver-pending');

      expect(result.status).toBe('PENDING');
      expect(result.blockchainAnchorStatus).toBe(BlockchainAnchorStatus.PENDING);
    });

    it('should return INVALID if block height is missing or block lookup fails', async () => {
      (prisma.documentVersion.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ver-tampered',
        sha256Hash: 'fake-hash',
        documentId: 'doc-1',
        document: { caseId: 'case-1' },
      });
      (prisma.blockchainApplicationAnchor.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'anc-fake',
        versionId: 'ver-tampered',
        status: BlockchainAnchorStatus.CONFIRMED,
        eventType: 'EVIDENCE_CREATED',
        evidenceHash: 'fake-hash',
        blockchainTxId: 'fake-tx-id',
        blockHash: 'fake-block-hash',
        blockHeight: BigInt(99999),
        policyId: 'STANDARD_ANCHOR',
        originatingNode: 'POLICE_NODE',
      });

      (prisma.blockchainBlock.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await verificationService.verifyEvidenceVersion('ver-tampered');

      expect(res.status).toBe('INVALID');
      expect(res.reason).toContain('Block at height 99999 not found');
    });
  });

  describe('5. Audit Checkpoint Service', () => {
    it('should create an audit checkpoint anchor from latest sequence number and hash', async () => {
      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const anchorRes = await checkpointService.createAuditCheckpoint(RoleName.ADMIN);

      expect(anchorRes).toBeDefined();
      expect(prisma.blockchainApplicationAnchor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'AUDIT_CHECKPOINT',
            auditSequenceNumber: BigInt(100),
          }),
        }),
      );
    });

    it('should verify audit chain state against recorded checkpoint', async () => {
      const latestHash = crypto.createHash('sha256').update('audit-event-100').digest('hex');

      (prisma.blockchainApplicationAnchor.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'audit-anc-1',
        status: BlockchainAnchorStatus.CONFIRMED,
        auditSequenceNumber: BigInt(100),
        evidenceHash: latestHash,
        blockchainTxId: 'tx-audit-1',
        blockHash: 'block-audit-1',
        blockHeight: BigInt(1),
      });

      (prisma.blockchainBlock.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await verificationService.verifyAuditCheckpoint();

      expect(res.status).toBe('INVALID');
    });
  });

  describe('6. Critical E2E Scenario: Version Independence vs External Storage Corruption', () => {
    it('should verify V1 and V2 get distinct legitimate anchors without triggering tamper alerts', async () => {
      const v1Bytes = Buffer.from('Version 1 Raw Content');
      const v1Hash = crypto.createHash('sha256').update(v1Bytes).digest('hex');

      const v2Bytes = Buffer.from('Version 2 Revised Content');
      const v2Hash = crypto.createHash('sha256').update(v2Bytes).digest('hex');

      // V1 & V2 SHA-256 hashes must be strictly different
      expect(v1Hash).not.toBe(v2Hash);

      // Anchor V1
      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const v1Res = await integrationService.anchorEvidenceCreation(
        'case-e2e',
        'doc-e2e',
        'ver-e2e-1',
        v1Hash,
        RoleName.INVESTIGATING_OFFICER,
      );

      // Anchor V2
      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const v2Res = await integrationService.anchorVersionCreation(
        'case-e2e',
        'doc-e2e',
        'ver-e2e-2',
        2,
        v2Hash,
        RoleName.INVESTIGATING_OFFICER,
      );

      // Idempotency keys must be distinct
      expect(v1Res.idempotencyKey).not.toBe(v2Res.idempotencyKey);
    });

    it('should anchor INTEGRITY_TAMPER_DETECTED only when actual storage bytes mismatch trusted DB hash', async () => {
      const trustedDbHash = crypto.createHash('sha256').update('original bytes').digest('hex');
      const corruptedBytes = Buffer.from('corrupted external bytes on disk');
      const corruptedActualHash = crypto.createHash('sha256').update(corruptedBytes).digest('hex');

      expect(trustedDbHash).not.toBe(corruptedActualHash);

      (prisma.blockchainApplicationAnchor.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Anchor Tamper Incident
      const tamperRes = await integrationService.anchorTamperIncident(
        'case-e2e',
        'doc-e2e',
        'ver-e2e-1',
        trustedDbHash,
        corruptedActualHash,
        'incident-99',
        RoleName.ADMIN,
      );

      expect(tamperRes.anchorId).toBeDefined();
      expect(prisma.blockchainApplicationAnchor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'INTEGRITY_TAMPER_DETECTED',
            evidenceHash: trustedDbHash,
          }),
        }),
      );
    });
  });
});
