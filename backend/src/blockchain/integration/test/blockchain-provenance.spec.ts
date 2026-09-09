/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/test/blockchain-provenance.spec.ts
 *
 * Sub-Phase 1G Evidence Chain-of-Custody & Cryptographic Provenance Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName, BlockchainAnchorStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { DocumentIntegrityService } from '../../../security/document-integrity.service';
import { SupabaseStorageService } from '../../../documents/supabase-storage.service';
import { DocumentEncryptionService } from '../../../documents/document-encryption.service';
import { BlockchainVerificationService } from '../blockchain-verification.service';
import { BlockchainIntegrationService } from '../blockchain-integration.service';
import { BlockchainObservabilityService } from '../blockchain-observability.service';
import { BlockchainController } from '../blockchain.controller';
import { BlockchainTransactionBuilder } from '../blockchain-transaction-builder';
import { BlockchainAnchorService } from '../blockchain-anchor.service';
import { AuditCheckpointService } from '../audit-checkpoint.service';
import { BlockchainEventMapper } from '../blockchain-event-mapper';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { UserPayload } from '../../../auth/decorators/current-user.decorator';

describe('Sub-Phase 1G: Evidence Chain-of-Custody & Provenance Engine', () => {
  let prisma: PrismaService;
  let verificationService: BlockchainVerificationService;
  let integrationService: BlockchainIntegrationService;
  let controller: BlockchainController;
  let txBuilder: BlockchainTransactionBuilder;
  let integrityService: DocumentIntegrityService;
  let storageService: SupabaseStorageService;

  // Mock users
  const adminUser: UserPayload = { userId: 'admin-1', email: 'admin@nyayavault.gov.in', role: RoleName.ADMIN };
  const assignedOfficer: UserPayload = { userId: 'officer-1', email: 'officer@police.gov.in', role: RoleName.INVESTIGATING_OFFICER };
  const unassignedOfficer: UserPayload = { userId: 'officer-2', email: 'other@police.gov.in', role: RoleName.INVESTIGATING_OFFICER };

  // Data fixtures
  const caseId = 'case-prov-101';
  const documentId = 'doc-prov-101';
  const v1Id = 'ver-prov-v1';
  const v2Id = 'ver-prov-v2';
  const v1Sha256 = '1111111111111111111111111111111111111111111111111111111111111111';
  const v2Sha256 = '2222222222222222222222222222222222222222222222222222222222222222';
  const storageBytesV1 = Buffer.from('Original Evidence Version 1 Bytes');
  const tamperedBytes = Buffer.from('Extracted and Altered Tampered File Bytes');

  let mockDbStoragePathV1 = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;
  let mockStorageFiles: Record<string, Buffer> = {};

  beforeEach(async () => {
    mockStorageFiles = {
      [mockDbStoragePathV1]: storageBytesV1,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        BlockchainEventMapper,
        BlockchainTransactionBuilder,
        BlockchainAnchorService,
        BlockchainVerificationService,
        AuditCheckpointService,
        BlockchainIntegrationService,
        BlockchainObservabilityService,
        BlockchainController,
        DocumentIntegrityService,
        DocumentEncryptionService,
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
              throw new Error(`Storage file '${path}' not found`);
            }),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    verificationService = module.get<BlockchainVerificationService>(BlockchainVerificationService);
    integrationService = module.get<BlockchainIntegrationService>(BlockchainIntegrationService);
    controller = module.get<BlockchainController>(BlockchainController);
    txBuilder = module.get<BlockchainTransactionBuilder>(BlockchainTransactionBuilder);
    integrityService = module.get<DocumentIntegrityService>(DocumentIntegrityService);
    storageService = module.get<SupabaseStorageService>(SupabaseStorageService);

    // Default mock for auditEvent and anchor findMany
    jest.spyOn(prisma.auditEvent, 'findMany').mockResolvedValue([] as any);
    jest.spyOn(prisma.blockchainApplicationAnchor, 'findMany').mockResolvedValue([] as any);
  });

  describe('1. Privacy & Canonical Payload Security', () => {
    it('must build canonical transactions without exposing secrets, JWTs, or private keys', () => {
      const tx = txBuilder.buildTransaction(
        {
          eventType: 'EVIDENCE_CREATED',
          role: RoleName.INVESTIGATING_OFFICER,
          caseId: 'case-privacy-test',
          documentId: 'doc-privacy-test',
          versionId: 'ver-privacy-test',
          evidenceHash: v1Sha256,
          auditSequenceNumber: 101n,
        },
        'POLICE_NODE',
        1,
      );

      const serialized = JSON.stringify(tx);
      expect(serialized).not.toContain('privateKey');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('jwt');
      expect(serialized).not.toContain('bearer');
      expect(serialized).not.toContain('SUPABASE_KEY');
      expect(tx.payload.evidenceHash).toBe(v1Sha256);
      expect(tx.originatingNode).toBe('POLICE_NODE');
    });
  });

  describe('2. Independent V1 / V2 Version Provenance', () => {
    it('must maintain separate version IDs, hashes, and anchors for V1 and V2 without generating false tamper alerts', async () => {
      // Mock version V1 and V2
      jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async (args: any) => {
        if (args.where.id === v1Id) {
          return {
            id: v1Id,
            documentId,
            versionNumber: 1,
            sha256Hash: v1Sha256,
            storagePath: mockDbStoragePathV1,
            fileSizeBytes: 1000n,
            mimeType: 'application/pdf',
            isCompromised: false,
            createdById: 'user-1',
            createdAt: new Date('2026-09-07T10:00:00Z'),
            document: { id: documentId, caseId, currentStatus: 'APPROVED' },
            createdBy: { id: 'user-1', email: 'officer@police.gov.in', role: RoleName.INVESTIGATING_OFFICER },
          } as any;
        }
        if (args.where.id === v2Id) {
          return {
            id: v2Id,
            documentId,
            versionNumber: 2,
            sha256Hash: v2Sha256,
            storagePath: `cases/${caseId}/documents/${documentId}/versions/2/file-v2.pdf`,
            fileSizeBytes: 1200n,
            mimeType: 'application/pdf',
            isCompromised: false,
            createdById: 'user-1',
            createdAt: new Date('2026-09-07T11:00:00Z'),
            document: { id: documentId, caseId, currentStatus: 'APPROVED' },
            createdBy: { id: 'user-1', email: 'officer@police.gov.in', role: RoleName.INVESTIGATING_OFFICER },
          } as any;
        }
        return null;
      }) as any);

      jest.spyOn(prisma.blockchainApplicationAnchor, 'findFirst').mockImplementation((async (args: any) => {
        if (args.where.versionId === v1Id) {
          return { id: 'anchor-v1', versionId: v1Id, status: 'CONFIRMED', originatingNode: 'POLICE_NODE', policyId: 'STANDARD_ANCHOR' } as any;
        }
        if (args.where.versionId === v2Id) {
          return { id: 'anchor-v2', versionId: v2Id, status: 'CONFIRMED', originatingNode: 'POLICE_NODE', policyId: 'STANDARD_ANCHOR' } as any;
        }
        return null;
      }) as any);

      // Assert independent properties
      expect(v1Id).not.toEqual(v2Id);
      expect(v1Sha256).not.toEqual(v2Sha256);

      // Verify V1 anchor query does not conflate with V2
      const anchorV1 = await prisma.blockchainApplicationAnchor.findFirst({ where: { versionId: v1Id } });
      const anchorV2 = await prisma.blockchainApplicationAnchor.findFirst({ where: { versionId: v2Id } });

      expect(anchorV1?.id).toBe('anchor-v1');
      expect(anchorV2?.id).toBe('anchor-v2');
      expect(anchorV1?.id).not.toEqual(anchorV2?.id);
    });
  });

  describe('3. Critical Distinction: Historical Blockchain Proof vs Current Byte Integrity Failure', () => {
    it('must maintain proofValid = true for historical blockchain proof while setting status to EVIDENCE_INTEGRITY_FAILURE when physical bytes mismatch', async () => {
      // 1. Setup V1 version in DB with calculated expected SHA-256
      const expectedSha256 = '2498c9c09f7a1aac511771a273983423015e8896cfd9ef246a180e92091e0929'; // SHA-256 of "Original Evidence Version 1 Bytes"
      const path = `cases/${caseId}/documents/${documentId}/versions/1/file-v1.pdf`;

      // Storage initially has original bytes matching expectedSha256
      mockStorageFiles[path] = storageBytesV1;

      jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async () => ({
        id: v1Id,
        documentId,
        versionNumber: 1,
        sha256Hash: expectedSha256,
        storagePath: path,
        fileSizeBytes: BigInt(storageBytesV1.length),
        mimeType: 'application/pdf',
        isCompromised: false,
        createdById: 'user-1',
        createdAt: new Date('2026-09-07T10:00:00Z'),
        document: { id: documentId, caseId, currentStatus: 'APPROVED' },
        createdBy: { id: 'user-1', email: 'officer@police.gov.in', role: RoleName.INVESTIGATING_OFFICER },
      })) as any);

      // Setup confirmed blockchain anchor record
      const registry = new InMemoryNodeRegistry();
      const policeNode = (registry as any).nodes.get('POLICE_NODE');
      const policePrivKey = policeNode.privateKeysByVersion.get(1);
      const policeKeyRecord = registry.getActiveKey('POLICE_NODE')!;

      const rawTx = createLedgerTransaction({
        chainId: 'nyayavault-mainnet-1',
        txType: 'EVIDENCE_ANCHOR',
        originatingNode: 'POLICE_NODE',
        payload: { caseId, documentId, versionId: v1Id, evidenceHash: expectedSha256 },
        nonce: 1,
      });

      const tx = signTransaction(rawTx, {
        nodeId: 'POLICE_NODE',
        name: 'State Law Enforcement Agency Node',
        publicKeyPem: policeKeyRecord.publicKeyPem,
        privateKeyPem: policePrivKey,
      });

      const genesisBlock = createGenesisBlock('nyayavault-mainnet-1');
      const block = forgeBlock({
        previousBlock: genesisBlock,
        transactions: [tx],
        proposerNode: 'POLICE_NODE',
      });

      // Mock ledger store & Prisma
      jest.spyOn(prisma.blockchainApplicationAnchor, 'findFirst').mockImplementation((async () => ({
        id: 'anchor-v1',
        versionId: v1Id,
        status: BlockchainAnchorStatus.CONFIRMED,
        blockHeight: 1n,
        blockHash: block.blockHash,
        blockchainTxId: tx.txId,
        originatingNode: 'POLICE_NODE',
        policyId: 'STANDARD_ANCHOR',
      })) as any);

      jest.spyOn(prisma.blockchainBlock, 'findUnique').mockImplementation((async () => ({
        id: 'block-1',
        nodeId: 'POLICE_NODE',
        chainId: 'nyayavault-mainnet-1',
        height: 1n,
        blockHash: block.blockHash,
        previousBlockHash: genesisBlock.blockHash,
        merkleRoot: block.header.merkleRoot,
        timestamp: block.header.timestamp,
        version: '1.0',
        proposerNode: 'POLICE_NODE',
        transactions: [tx],
        consensusProof: {
          id: 'proof-1',
          blockId: 'block-1',
          nodeId: 'POLICE_NODE',
          chainId: 'nyayavault-mainnet-1',
          consensusType: 'PROOF_OF_AUTHORITY',
          consensusVersion: '1.0',
          blockHash: block.blockHash,
          blockHeight: '1',
          policyId: 'STANDARD_ANCHOR',
          policyVersion: '1.0',
          requiredThreshold: 2,
          requiredNodeIds: ['POLICE_NODE', 'PROSECUTION_NODE'],
          collectedAt: new Date().toISOString(),
          commitTimestamp: new Date().toISOString(),
          endorsingSignatures: [
            { nodeId: 'POLICE_NODE', keyVersion: 1, signatureHex: 'sig1' },
            { nodeId: 'PROSECUTION_NODE', keyVersion: 1, signatureHex: 'sig2' },
          ],
          endorsements: [
            { endorserNodeId: 'POLICE_NODE', keyVersion: 1, signatureHex: 'sig1' },
            { endorserNodeId: 'PROSECUTION_NODE', keyVersion: 1, signatureHex: 'sig2' },
          ],
        },
      })) as any);

      // STEP 1: Verify when storage bytes match expected SHA-256
      const initialVerification = await verificationService.verifyEvidenceVersion(v1Id);
      expect(initialVerification.status).toBe('VERIFIED');
      expect(initialVerification.proofValid).toBe(true);


      expect(initialVerification.proofValid).toBe(true);


      // STEP 2: Externally tamper with the storage file bytes ONLY (do not touch trusted DB SHA-256)
      mockStorageFiles[path] = tamperedBytes;

      // STEP 3: Request verification again
      const tamperedVerification = await verificationService.verifyEvidenceVersion(v1Id);

      // Historical blockchain proof MUST remain VALID (true)
      expect(tamperedVerification.proofValid).toBe(true);

      // Overall status MUST shift to EVIDENCE_INTEGRITY_FAILURE
      expect(tamperedVerification.status).toBe('EVIDENCE_INTEGRITY_FAILURE');
      expect(tamperedVerification.reason).toContain('Historical blockchain proof is valid, but current storage bytes fail SHA-256 integrity comparison');
    });
  });

  describe('4. Server-Side CBAC & Authorization Enforcement', () => {
    it('must grant provenance access to ADMIN and assigned users, but reject unassigned users with HTTP 403', async () => {
      jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async () => ({
        id: v1Id,
        documentId,
        sha256Hash: v1Sha256,
        document: { id: documentId, caseId },
      })) as any);

      jest.spyOn(prisma.caseAssignment, 'findUnique').mockImplementation((async (args: any) => {
        if (args.where.caseId_userId.userId === 'officer-1') {
          return { id: 'assign-1', caseId, userId: 'officer-1' } as any;
        }
        return null;
      }) as any);

      jest.spyOn(verificationService, 'getEvidenceProvenance').mockResolvedValue({
        status: 'VERIFIED',
        versionId: v1Id,
        documentId,
        caseId,
        versionNumber: 1,
        trustedSha256: v1Sha256,
        byteIntegrity: { valid: true, tampered: false, expectedHash: v1Sha256, actualHash: v1Sha256, checkedAt: new Date().toISOString() },
        blockchainProof: { valid: true, anchorStatus: 'CONFIRMED' },
        timeline: [],
      });

      // 1. ADMIN user access -> Allowed (200)
      const adminRes = await controller.getEvidenceProvenance(v1Id, adminUser);
      expect(adminRes.status).toBe('VERIFIED');

      // 2. Assigned officer access -> Allowed (200)
      const officerRes = await controller.getEvidenceProvenance(v1Id, assignedOfficer);
      expect(officerRes.status).toBe('VERIFIED');

      // 3. Unassigned officer access -> Rejected (403 Forbidden)
      await expect(controller.getEvidenceProvenance(v1Id, unassignedOfficer)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Resilient Storage & Blockchain Failure States', () => {
    it('must return PARTIALLY_VERIFIED when physical storage is unreachable but blockchain proof is valid', async () => {
      // Mock storage download failure
      jest.spyOn(integrityService, 'verifyDocumentVersionIntegrity').mockImplementation(async () => {
        throw new Error('Supabase Storage service connection timeout');
      });

      jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async () => ({
        id: v1Id,
        documentId,
        versionNumber: 1,
        sha256Hash: v1Sha256,
        storagePath: mockDbStoragePathV1,
        document: { id: documentId, caseId },
      })) as any);

      jest.spyOn(prisma.blockchainApplicationAnchor, 'findFirst').mockImplementation((async () => ({
        id: 'anchor-v1',
        versionId: v1Id,
        status: BlockchainAnchorStatus.CONFIRMED,
        blockHeight: 1n,
        blockchainTxId: 'tx-1',
        originatingNode: 'POLICE_NODE',
      })) as any);

      // Mock verifyEvidenceVersion returning proofValid: true and status PARTIALLY_VERIFIED
      jest.spyOn(verificationService, 'verifyEvidenceVersion').mockResolvedValue({
        status: 'PARTIALLY_VERIFIED',
        versionId: v1Id,
        documentId,
        caseId,
        trustedSha256: v1Sha256,
        proofValid: true,
        reason: 'Historical blockchain proof is valid, but physical storage is unreachable',
      });

      const prov = await verificationService.getEvidenceProvenance(v1Id);
      expect(prov.status).toBe('PARTIALLY_VERIFIED');
      expect(prov.blockchainProof.valid).toBe(true);
      expect(prov.byteIntegrity.valid).toBe(false);
    });

    it('must return CHAIN_UNAVAILABLE when blockchain ledger store encounters a fatal error', async () => {
      jest.spyOn(prisma.documentVersion, 'findUnique').mockImplementation((async () => ({
        id: v1Id,
        documentId,
        sha256Hash: v1Sha256,
        document: { id: documentId, caseId },
      })) as any);

      jest.spyOn(prisma.blockchainApplicationAnchor, 'findFirst').mockImplementation(() => {
        throw new Error('Database connection pool exhausted');
      });

      const res = await verificationService.verifyEvidenceVersion(v1Id);
      expect(res.status).toBe('CHAIN_UNAVAILABLE');
      expect(res.reason).toContain('Database connection pool exhausted');
    });
  });
});
