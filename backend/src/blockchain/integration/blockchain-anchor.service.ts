/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-anchor.service.ts
 *
 * Deterministic Idempotent Application Anchor Service
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainAnchorStatus } from '@prisma/client';
import { PrismaLedgerStore } from '../ledger/prisma-ledger-store';
import { InMemoryNodeRegistry } from '../identity/in-memory-node-registry';
import { forgeBlock } from '../ledger/block';
import { createBlockProposal, createBlockEndorsement } from '../consensus/endorsement-signer';
import { BlockchainEventMapper } from './blockchain-event-mapper';
import { BlockchainTransactionBuilder } from './blockchain-transaction-builder';
import { BlockchainAnchorIntentParams } from './types';
import { PhysicalNodeAnchorGateway } from './physical-node-anchor-gateway';
import { LedgerNodeIdentity, NodeType } from '../ledger/types';

@Injectable()
export class BlockchainAnchorService {
  private readonly logger = new Logger(BlockchainAnchorService.name);
  private nonceCounter = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventMapper: BlockchainEventMapper,
    private readonly txBuilder: BlockchainTransactionBuilder,
  ) {}

  /**
   * Non-blocking, idempotent application event anchoring pipeline
   */
  async submitAnchorIntent(params: BlockchainAnchorIntentParams): Promise<{
    anchorId: string;
    idempotencyKey: string;
    status: BlockchainAnchorStatus;
    isDuplicate: boolean;
  }> {
    const idempotencyKey = this.eventMapper.computeIdempotencyKey(params);
    const policyId = this.eventMapper.mapEventToPolicyId(params.eventType);
    const originatingNodeId = params.nodeId || this.eventMapper.mapRoleToNodeId(params.role);

    // 1. Idempotency Check: Retrieve existing anchor if already created
    const existingAnchor = await this.prisma.blockchainApplicationAnchor.findUnique({
      where: { idempotencyKey },
    });

    if (existingAnchor) {
      return {
        anchorId: existingAnchor.id,
        idempotencyKey: existingAnchor.idempotencyKey,
        status: existingAnchor.status,
        isDuplicate: true,
      };
    }

    // 2. Persist initial PENDING anchor record in PostgreSQL
    const anchorRecord = await this.prisma.blockchainApplicationAnchor.create({
      data: {
        idempotencyKey,
        eventType: params.eventType,
        policyId,
        originatingNode: originatingNodeId,
        caseId: params.caseId || null,
        documentId: params.documentId || null,
        versionId: params.versionId || null,
        auditSequenceNumber: params.auditSequenceNumber ? BigInt(params.auditSequenceNumber) : null,
        evidenceHash: params.evidenceHash || params.expectedHash || null,
        status: BlockchainAnchorStatus.PENDING,
      },
    });

    // 3. Trigger Asynchronous Consensus & Blockchain Storage Write
    setImmediate(() => {
      this.processAnchorConsensus(anchorRecord.id, params, originatingNodeId, policyId).catch((err) => {
        this.logger.error(`Background anchor processing failed for ID '${anchorRecord.id}': ${err.message}`);
      });
    });

    return {
      anchorId: anchorRecord.id,
      idempotencyKey,
      status: BlockchainAnchorStatus.PENDING,
      isDuplicate: false,
    };
  }

  /**
   * Process PoA Consensus & Commit Block to Persistent Store
   */
  async processAnchorConsensus(
    anchorId: string,
    params: BlockchainAnchorIntentParams,
    originatingNodeId: NodeType,
    policyId: string,
    chainId = 'nyayavault-mainnet-1',
  ): Promise<void> {
    try {
      // 0. Physical Gateway Route Check
      const gatewayUrl = process.env.BLOCKCHAIN_GATEWAY_URL;
      const appServiceSecret = process.env.BLOCKCHAIN_APP_SERVICE_SECRET;

      if (gatewayUrl) {
        const gateway = new PhysicalNodeAnchorGateway({ gatewayUrl, appServiceSecret });
        const res = await gateway.submitAnchor(params, policyId);

        if (res.success) {
          await this.prisma.blockchainApplicationAnchor.update({
            where: { id: anchorId },
            data: {
              status: BlockchainAnchorStatus.CONFIRMED,
              blockchainTxId: res.txId || null,
              blockHash: res.blockHash || null,
              blockHeight: res.blockHeight ? BigInt(res.blockHeight) : null,
              confirmedAt: new Date(),
            },
          });
          this.logger.log(`Blockchain anchor CONFIRMED via physical gateway for ID '${anchorId}'`);
          return;
        } else {
          await this.prisma.blockchainApplicationAnchor.update({
            where: { id: anchorId },
            data: {
              status: BlockchainAnchorStatus.FAILED,
              failureReason: res.error || 'Gateway submission failed',
            },
          });
          this.logger.error(`Physical gateway anchor submission failed for ID '${anchorId}': ${res.error}`);
          return;
        }
      }
      const registry = new InMemoryNodeRegistry();
      const store = new PrismaLedgerStore({
        prisma: this.prisma as any,
        nodeId: originatingNodeId,
        chainId,
      });

      // Ensure store is initialized with genesis block
      const latestBlock = await store.initialize();

      // Retrieve originating node key credentials
      const origNode = registry.getNode(originatingNodeId);
      if (!origNode) {
        throw new Error(`Node '${originatingNodeId}' not registered in node topology`);
      }

      const origSigner: LedgerNodeIdentity = {
        nodeId: originatingNodeId,
        name: origNode.organization,
        publicKeyPem: origNode.keys[0].publicKeyPem,
        privateKeyPem: origNode.privateKeysByVersion.get(1),
      };

      // 1. Build and sign canonical transaction
      const nonce = this.nonceCounter++;
      const unsignedTx = this.txBuilder.buildTransaction(params, originatingNodeId, nonce, chainId);
      const signedTx = this.txBuilder.signTransactionPayload(unsignedTx, origSigner);

      // Transition anchor status to SUBMITTED once transaction payload is constructed
      await this.prisma.blockchainApplicationAnchor.update({
        where: { id: anchorId },
        data: {
          status: BlockchainAnchorStatus.SUBMITTED,
          blockchainTxId: signedTx.txId,
        },
      });

      // 2. Forge candidate block
      const blockHeight = (BigInt(latestBlock.header.height) + 1n).toString();
      const block = forgeBlock({
        previousBlock: latestBlock,
        transactions: [signedTx],
        proposerNode: originatingNodeId,
      });

      // 3. Create BlockProposal and collect multi-node endorsements
      const proposal = createBlockProposal({
        proposerNode: origNode,
        block,
        policyId,
        chainId,
      });

      // Determine required threshold & required endorsers based on policy
      const endorserNodeIds: NodeType[] =
        policyId === 'SEALED_EVIDENCE'
          ? ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE']
          : ['POLICE_NODE', 'PROSECUTION_NODE'];

      const endorsingSignatures = [];
      for (const endorserId of endorserNodeIds) {
        const endorserNode = registry.getNode(endorserId);
        if (endorserNode) {
          const endorsement = createBlockEndorsement({ endorserNode, proposal });
          endorsingSignatures.push({
            nodeId: endorserId,
            keyVersion: endorsement.keyVersion,
            keyFingerprint: endorsement.keyFingerprint,
            publicKeyPem: endorserNode.keys[0].publicKeyPem,
            signatureHex: endorsement.signatureHex,
            signedAt: endorsement.signedAt,
          });
        }
      }

      // 4. Attach valid PoAConsensusProof to candidate block
      block.consensusProof = {
        consensusType: 'PROOF_OF_AUTHORITY',
        consensusVersion: '1.0',
        proposalId: proposal.proposalId,
        blockHash: block.blockHash,
        chainId,
        blockHeight,
        policyId,
        policyVersion: '1.0',
        requiredThreshold: endorserNodeIds.length,
        requiredNodeIds: endorserNodeIds,
        endorsingSignatures,
        collectedAt: new Date().toISOString(),
        commitTimestamp: new Date().toISOString(),
      };

      // 5. Append block to persistent store
      await store.appendBlock(block);

      // 6. Update BlockchainApplicationAnchor status to CONFIRMED
      await this.prisma.blockchainApplicationAnchor.update({
        where: { id: anchorId },
        data: {
          status: BlockchainAnchorStatus.CONFIRMED,
          blockchainTxId: signedTx.txId,
          blockHash: block.blockHash,
          blockHeight: BigInt(blockHeight),
          confirmedAt: new Date(),
        },
      });

      this.logger.log(`Blockchain anchor CONFIRMED for ID '${anchorId}' at block height ${blockHeight}`);
    } catch (err: any) {
      this.logger.error(`Anchor consensus processing failed for ID '${anchorId}': ${err.message}`);
      await this.prisma.blockchainApplicationAnchor.update({
        where: { id: anchorId },
        data: {
          status: BlockchainAnchorStatus.FAILED,
          failureReason: err.message,
        },
      });
    }
  }

  /**
   * Retry a FAILED or PENDING anchor
   */
  async retryAnchor(anchorId: string): Promise<boolean> {
    const anchor = await this.prisma.blockchainApplicationAnchor.findUnique({
      where: { id: anchorId },
    });

    if (!anchor || anchor.status === BlockchainAnchorStatus.CONFIRMED) {
      return false;
    }

    const params: BlockchainAnchorIntentParams = {
      eventType: anchor.eventType as any,
      nodeId: anchor.originatingNode as any,
      caseId: anchor.caseId || undefined,
      documentId: anchor.documentId || undefined,
      versionId: anchor.versionId || undefined,
      auditSequenceNumber: anchor.auditSequenceNumber || undefined,
      evidenceHash: anchor.evidenceHash || undefined,
    };

    await this.processAnchorConsensus(anchor.id, params, anchor.originatingNode as any, anchor.policyId);
    return true;
  }
}
