/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-verification.service.ts
 *
 * Independent Cryptographic Verification Service
 */

import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaLedgerStore } from '../ledger/prisma-ledger-store';
import { InMemoryNodeRegistry } from '../identity/in-memory-node-registry';
import { PoAConsensusEngine } from '../consensus/poa-consensus-engine';
import { computeBlockHash } from '../ledger/block';
import { buildMerkleTree } from '../ledger/merkle';
import { verifyTransaction } from '../ledger/transaction';
import { DocumentIntegrityService } from '../../security/document-integrity.service';
import {
  EvidenceVerificationResponse,
  AuditVerificationResponse,
  EvidenceProvenanceResponse,
  ByteIntegrityResult,
  BlockchainProofResult,
  ProvenanceTimelineEvent,
  VerificationResultCode,
} from './types';

@Injectable()
export class BlockchainVerificationService {
  private readonly logger = new Logger(BlockchainVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly integrityService?: DocumentIntegrityService,
  ) {}

  /**
   * Independently verify permissioned blockchain proof for an evidence version
   * Evaluates historical blockchain consensus proof AND current physical file byte integrity
   */
  async verifyEvidenceVersion(versionId: string): Promise<EvidenceVerificationResponse> {
    // 1. Retrieve authoritative DocumentVersion record from Prisma
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: true },
    });

    if (!version) {
      throw new NotFoundException(`Document version '${versionId}' not found`);
    }

    const trustedSha256 = version.sha256Hash;
    const documentId = version.documentId;
    const caseId = version.document.caseId;

    try {
      // 2. Locate BlockchainApplicationAnchor record
      const anchor = await this.prisma.blockchainApplicationAnchor.findFirst({
        where: { versionId },
        orderBy: { createdAt: 'desc' },
      });

      if (!anchor) {
        return {
          status: 'NOT_ANCHORED',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          reason: `No blockchain anchor intent found for version '${versionId}'`,
        };
      }

      if (anchor.status === 'PENDING' || anchor.status === 'SUBMITTED') {
        return {
          status: 'PENDING',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          blockchainAnchorStatus: anchor.status,
          reason: `Blockchain anchoring is currently in state '${anchor.status}'`,
        };
      }

      if (anchor.status === 'FAILED' || anchor.status === 'REJECTED') {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          blockchainAnchorStatus: anchor.status,
          proofValid: false,
          reason: `Blockchain anchoring failed: ${anchor.failureReason || 'Consensus rejected'}`,
        };
      }

      // 3. Anchor is CONFIRMED — Perform full cryptographic validation of block, Merkle root, tx, & PoA proof
      const store = new PrismaLedgerStore({
        prisma: this.prisma as any,
        nodeId: (anchor.originatingNode as any) || 'POLICE_NODE',
      });


      if (!anchor.blockHeight) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: 'Confirmed anchor record lacks block height',
        };
      }

      const block = await store.getBlockByHeight(anchor.blockHeight);
      if (!block) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Block at height ${anchor.blockHeight} not found in persistent store`,
        };
      }

      // 4. Verify Block Header Hash Recomputation
      const recomputedBlockHash = computeBlockHash(block.header);
      if (block.blockHash !== recomputedBlockHash) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Block header hash recomputation mismatch: expected '${block.blockHash}', got '${recomputedBlockHash}'`,
        };
      }

      // 5. Verify Merkle Root Rebuild
      const txHashes = block.transactions.map((t) => t.txId);
      const { root: expectedMerkleRoot } = buildMerkleTree(txHashes);
      if (block.header.merkleRoot !== expectedMerkleRoot) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Merkle root mismatch: expected '${block.header.merkleRoot}', recomputed '${expectedMerkleRoot}'`,
        };
      }

      // 6. Locate Target Transaction in Block
      const targetTx = block.transactions.find((t) => t.txId === anchor.blockchainTxId);
      if (!targetTx) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Transaction '${anchor.blockchainTxId}' not contained in block ${anchor.blockHeight}`,
        };
      }

      // 7. Verify Transaction Digest & Signatures
      const registry = new InMemoryNodeRegistry();
      for (const sig of targetTx.signatures) {
        if (!sig.publicKeyPem) {
          const keyRecord = registry.getActiveKey(sig.nodeId as any);
          if (keyRecord) sig.publicKeyPem = keyRecord.publicKeyPem;
        }
      }

      const txVal = verifyTransaction(targetTx);
      if (!txVal.valid) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Transaction verification failed: ${txVal.reason}`,
        };
      }

      // 8. Verify PoA Multi-Signature Consensus Proof
      const poaEngine = new PoAConsensusEngine(registry);
      const consensusVal = poaEngine.validateConsensusProof(block, block.consensusProof);

      if (!consensusVal.valid) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `PoA consensus proof validation failed: ${consensusVal.reason}`,
        };
      }

      // 9. Verify Payload Hash Reference matches Trusted Database SHA-256
      const payloadHash = targetTx.payload.evidenceHash;
      if (payloadHash && payloadHash.toLowerCase() !== trustedSha256.toLowerCase()) {
        return {
          status: 'INVALID',
          versionId,
          documentId,
          caseId,
          trustedSha256,
          proofValid: false,
          reason: `Anchored evidence hash '${payloadHash}' does not match trusted database hash '${trustedSha256}'`,
        };
      }

      // 10. Blockchain cryptographic proof is VALID. Now evaluate physical storage byte integrity
      let overallStatus: VerificationResultCode = 'VERIFIED';
      let statusReason: string | undefined = undefined;

      if (this.integrityService) {
        try {
          const byteCheck = await this.integrityService.verifyDocumentVersionIntegrity(documentId, versionId);
          if (!byteCheck.valid) {
            if (byteCheck.error === 'BYTE_LEVEL_SHA256_MISMATCH' || (byteCheck.tampered && byteCheck.actualHash !== 'STORAGE_OBJECT_UNREADABLE_OR_MISSING' && byteCheck.actualHash !== 'STORAGE_UNREACHABLE')) {
              overallStatus = 'EVIDENCE_INTEGRITY_FAILURE';
              statusReason = 'Historical blockchain proof is valid, but current storage bytes fail SHA-256 integrity comparison';
            } else {
              overallStatus = 'PARTIALLY_VERIFIED';
              statusReason = 'Historical blockchain proof is valid, but physical storage bytes could not be retrieved';
            }
          }
        } catch (byteErr: any) {
          overallStatus = 'PARTIALLY_VERIFIED';
          statusReason = `Historical blockchain proof is valid, but physical storage is unreachable: ${byteErr.message}`;
        }
      }

      return {
        status: overallStatus,
        versionId,
        documentId,
        caseId,
        trustedSha256,
        blockchainAnchorStatus: anchor.status,
        blockHeight: anchor.blockHeight.toString(),
        blockHash: block.blockHash,
        blockchainTxId: targetTx.txId,
        originatingNode: anchor.originatingNode,
        policyId: anchor.policyId,
        proofValid: true,
        reason: statusReason,
      };
    } catch (err: any) {
      this.logger.error(`Cryptographic verification exception for version '${versionId}': ${err.message}`);
      return {
        status: 'CHAIN_UNAVAILABLE',
        versionId,
        documentId,
        caseId,
        trustedSha256,
        reason: `Blockchain verification system error: ${err.message}`,
      };
    }
  }

  /**
   * Comprehensive evidence chain-of-custody provenance retrieval
   */
  async getEvidenceProvenance(versionId: string): Promise<EvidenceProvenanceResponse> {
    // 1. Fetch authoritative DocumentVersion record
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        document: true,
        createdBy: { select: { id: true, email: true, role: true } },
      },
    });

    if (!version) {
      throw new NotFoundException(`Document version '${versionId}' not found`);
    }

    const documentId = version.documentId;
    const caseId = version.document.caseId;
    const trustedSha256 = version.sha256Hash;

    // 2. Perform live blockchain proof verification
    const proofVal = await this.verifyEvidenceVersion(versionId);

    // 3. Evaluate physical file storage byte integrity
    let byteIntegrity: ByteIntegrityResult = {
      valid: true,
      tampered: false,
      expectedHash: trustedSha256,
      actualHash: trustedSha256,
      checkedAt: new Date().toISOString(),
    };

    if (this.integrityService) {
      try {
        const res = await this.integrityService.verifyDocumentVersionIntegrity(documentId, versionId);
        const isStorageMissing = res.actualHash === 'STORAGE_OBJECT_UNREADABLE_OR_MISSING' || res.actualHash === 'STORAGE_UNREACHABLE';
        byteIntegrity = {
          valid: res.valid,
          tampered: isStorageMissing ? false : res.tampered,
          expectedHash: res.expectedHash,
          actualHash: res.actualHash,
          checkedAt: res.checkedAt,
          error: res.error,
        };
      } catch (err: any) {
        byteIntegrity = {
          valid: false,
          tampered: false,
          expectedHash: trustedSha256,
          actualHash: 'STORAGE_UNREACHABLE',
          checkedAt: new Date().toISOString(),
          error: err.message,
        };
      }
    }

    // Determine final status
    let finalStatus: VerificationResultCode = proofVal.status;
    if (proofVal.proofValid && !byteIntegrity.valid) {
      if (byteIntegrity.error === 'BYTE_LEVEL_SHA256_MISMATCH' || (byteIntegrity.tampered && byteIntegrity.actualHash !== 'STORAGE_UNREACHABLE' && byteIntegrity.actualHash !== 'STORAGE_OBJECT_UNREADABLE_OR_MISSING')) {
        finalStatus = 'EVIDENCE_INTEGRITY_FAILURE';
      } else {
        finalStatus = 'PARTIALLY_VERIFIED';
      }
    }


    // 4. Query linked AuditEvents for document/version lineage
    const auditEvents = await this.prisma.auditEvent.findMany({
      where: {
        OR: [
          { versionId },
          { documentId, versionId: null, createdAt: { lte: version.createdAt } },
        ],
      },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });

    // 5. Query linked BlockchainApplicationAnchors for version & document
    const anchors = await this.prisma.blockchainApplicationAnchor.findMany({
      where: {
        OR: [{ versionId }, { documentId }],
      },
    });

    // Map audit events to provenance timeline events
    const timeline: ProvenanceTimelineEvent[] = auditEvents.map((evt) => {
      const matchedAnchor = anchors.find(
        (a) =>
          a.versionId === evt.versionId ||
          (a.auditSequenceNumber !== null && BigInt(a.auditSequenceNumber) === evt.sequenceNumber) ||
          a.eventType === evt.eventType,
      );

      return {
        timestamp: evt.createdAt.toISOString(),
        sequenceNumber: evt.sequenceNumber.toString(),
        eventHash: evt.currentEventHash,
        eventType: evt.eventType,
        action: evt.action,
        originatingNode: matchedAnchor?.originatingNode || undefined,
        anchorStatus: matchedAnchor?.status || undefined,
        blockchainTxId: matchedAnchor?.blockchainTxId || undefined,
        blockHeight: matchedAnchor?.blockHeight ? matchedAnchor.blockHeight.toString() : undefined,
        blockHash: matchedAnchor?.blockHash || undefined,
        consensusPolicy: matchedAnchor?.policyId || undefined,
        userId: evt.userId || undefined,
        userEmail: evt.user?.email || undefined,
        userRole: evt.user?.role || undefined,
      };
    });

    const blockchainProof: BlockchainProofResult = {
      valid: proofVal.proofValid ?? false,
      anchorStatus: proofVal.blockchainAnchorStatus,
      blockHeight: proofVal.blockHeight,
      blockHash: proofVal.blockHash,
      txId: proofVal.blockchainTxId,
      policyId: proofVal.policyId,
      originatingNode: proofVal.originatingNode,
      reason: proofVal.reason,
    };

    return {
      status: finalStatus,
      versionId,
      documentId,
      caseId,
      versionNumber: version.versionNumber,
      trustedSha256,
      byteIntegrity,
      blockchainProof,
      timeline,
    };
  }


  /**
   * Independently verify application audit chain checkpoint on blockchain
   */
  async verifyAuditCheckpoint(): Promise<AuditVerificationResponse> {
    const latestEvent = await this.prisma.auditEvent.findFirst({
      orderBy: { sequenceNumber: 'desc' },
    });

    if (!latestEvent) {
      return {
        status: 'NOT_ANCHORED',
        latestSequenceNumber: '0',
        latestEventHash: '',
        reason: 'No audit events exist in system',
      };
    }

    const latestSeqStr = latestEvent.sequenceNumber.toString();
    const latestHash = latestEvent.currentEventHash;

    const anchor = await this.prisma.blockchainApplicationAnchor.findFirst({
      where: { eventType: 'AUDIT_CHECKPOINT' },
      orderBy: { createdAt: 'desc' },
    });

    if (!anchor) {
      return {
        status: 'NOT_ANCHORED',
        latestSequenceNumber: latestSeqStr,
        latestEventHash: latestHash,
        reason: 'No audit checkpoint has been anchored on blockchain',
      };
    }

    if (anchor.status !== 'CONFIRMED') {
      return {
        status: 'PENDING',
        latestSequenceNumber: latestSeqStr,
        latestEventHash: latestHash,
        blockchainAnchorStatus: anchor.status,
      };
    }

    try {
      const store = new PrismaLedgerStore({
        prisma: this.prisma as any,
        nodeId: (anchor.originatingNode as any) || 'ADMIN_NODE',
      });

      const block = await store.getBlockByHeight(anchor.blockHeight!);
      if (!block) {
        return {
          status: 'INVALID',
          latestSequenceNumber: latestSeqStr,
          latestEventHash: latestHash,
          proofValid: false,
          reason: `Checkpoint block ${anchor.blockHeight} missing in store`,
        };
      }

      const registry = new InMemoryNodeRegistry();
      const poaEngine = new PoAConsensusEngine(registry);
      const consensusVal = poaEngine.validateConsensusProof(block, block.consensusProof);

      if (!consensusVal.valid) {
        return {
          status: 'INVALID',
          latestSequenceNumber: latestSeqStr,
          latestEventHash: latestHash,
          proofValid: false,
          reason: `Audit checkpoint PoA proof invalid: ${consensusVal.reason}`,
        };
      }

      return {
        status: 'VERIFIED',
        latestSequenceNumber: latestSeqStr,
        latestEventHash: latestHash,
        blockchainAnchorStatus: anchor.status,
        blockHeight: anchor.blockHeight?.toString(),
        blockHash: block.blockHash,
        blockchainTxId: anchor.blockchainTxId || undefined,
        proofValid: true,
      };
    } catch (err: any) {
      return {
        status: 'CHAIN_UNAVAILABLE',
        latestSequenceNumber: latestSeqStr,
        latestEventHash: latestHash,
        reason: err.message,
      };
    }
  }
}
