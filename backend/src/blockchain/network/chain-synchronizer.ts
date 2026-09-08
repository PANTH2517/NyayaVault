/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/chain-synchronizer.ts
 *
 * Peer Ledger Synchronization & Chain Divergence Detection Engine
 */

import { LedgerBlock, VerificationResult } from '../ledger/types';
import { LedgerEngine } from '../ledger/ledger-engine';
import { validateBlockStructure } from '../ledger/block';
import { DefaultPoAConsensusEngine } from '../ledger/consensus-interface';
import { INodeTransport } from './transport.interface';
import { PeerRegistry } from './peer-registry';
import { createNetworkEnvelope, verifyNetworkEnvelope } from './envelope';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity, NodeType } from '../identity/types';
import {
  ChainRequestPayload,
  ChainResponsePayload,
  DivergenceResult,
  NetworkMessageEnvelope,
  NodeNetworkStatus,
} from './types';

export const MAX_BLOCKS_PER_SYNC_REQUEST = 100;

export interface SyncResult {
  success: boolean;
  blocksSynced: number;
  divergence?: DivergenceResult;
  error?: string;
}

export class ChainSynchronizer {
  private readonly consensusEngine = new DefaultPoAConsensusEngine();

  constructor(
    private readonly localNode: NodeIdentity,
    private readonly nodeRegistry: INodeRegistry,
    private readonly ledgerEngine: LedgerEngine,
    private readonly peerRegistry: PeerRegistry,
    private readonly transport: INodeTransport,
    private readonly chainId: string,
  ) {}

  /**
   * Detect chain divergence between local status and remote peer status
   */
  detectDivergence(
    localStatus: NodeNetworkStatus,
    peerStatus: NodeNetworkStatus,
  ): DivergenceResult {
    // 1. Verify chain ID match
    if (localStatus.chainId !== peerStatus.chainId) {
      return {
        diverged: true,
        code: 'CHAIN_ID_MISMATCH',
        reason: `Local chainId '${localStatus.chainId}' does not match peer chainId '${peerStatus.chainId}'`,
      };
    }

    // 2. Verify genesis hash match
    if (localStatus.genesisHash !== peerStatus.genesisHash) {
      return {
        diverged: true,
        code: 'GENESIS_HASH_MISMATCH',
        reason: `Local genesis hash '${localStatus.genesisHash}' does not match peer genesis hash '${peerStatus.genesisHash}'`,
      };
    }

    const localH = BigInt(localStatus.currentHeight);
    const peerH = BigInt(peerStatus.currentHeight);

    // 3. Same height but conflicting latest hash -> Split/Divergent history
    if (localH === peerH && localH >= 0n) {
      if (localStatus.latestBlockHash !== peerStatus.latestBlockHash) {
        return {
          diverged: true,
          code: 'SAME_HEIGHT_DIFFERENT_HASH',
          reason: `Both nodes at height ${localH} but have different block hashes`,
          localHeight: localStatus.currentHeight,
          peerHeight: peerStatus.currentHeight,
          localBlockHash: localStatus.latestBlockHash,
          peerBlockHash: peerStatus.latestBlockHash,
        };
      }
    }

    return { diverged: false };
  }

  /**
   * Verify received blocks snapshot in-memory without mutating local store state
   */
  verifyPeerChainSnapshot(
    blocks: LedgerBlock[],
    parentBlock: LedgerBlock | null,
  ): VerificationResult {
    if (blocks.length === 0) {
      return { valid: true, details: { verifiedCount: 0 } };
    }

    let prev = parentBlock;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Verify chain ID
      if (block.header.chainId !== this.chainId) {
        return {
          valid: false,
          code: 'CHAIN_ID_MISMATCH',
          reason: `Block at index ${i} has chainId '${block.header.chainId}', expected '${this.chainId}'`,
        };
      }

      // Verify structural integrity & link to previous block
      if (prev) {
        const structValidation = validateBlockStructure(block, prev);
        if (!structValidation.valid) {
          return {
            valid: false,
            code: 'INVALID_BLOCK_STRUCTURE',
            reason: `Block height ${block.header.height} failed structure validation: ${structValidation.reason}`,
          };
        }
      }

      // Verify PoA consensus proof
      const consensusVal = this.consensusEngine.validateConsensusProof(
        block,
        block.consensusProof,
      );
      if (!consensusVal.valid) {
        return {
          valid: false,
          code: 'INVALID_CONSENSUS_PROOF',
          reason: `Block height ${block.header.height} failed consensus proof validation: ${consensusVal.reason}`,
        };
      }

      prev = block;
    }

    return { valid: true, details: { verifiedCount: blocks.length } };
  }

  /**
   * Synchronize missing blocks from remote peer
   */
  async synchronizeFromPeer(
    peerNodeId: NodeType,
    peerStatus: NodeNetworkStatus,
  ): Promise<SyncResult> {
    const localLatest = await this.ledgerEngine.getLatestBlock();
    const localHeight = await this.ledgerEngine.getHeight();
    const localGenesis = await this.ledgerEngine.getBlockByHeight(0n);

    const localStatus: NodeNetworkStatus = {

      nodeId: this.localNode.nodeId,
      chainId: this.chainId,
      currentHeight: localHeight.toString(),
      latestBlockHash: localLatest?.blockHash || '',
      genesisHash: localGenesis?.blockHash || '',
      protocolVersion: '1.0',
      timestamp: new Date().toISOString(),
    };

    // 1. Check divergence
    const divergence = this.detectDivergence(localStatus, peerStatus);
    if (divergence.diverged) {
      this.peerRegistry.updateHealth(peerNodeId, { syncState: 'DIVERGED' });
      return {
        success: false,
        blocksSynced: 0,
        divergence,
        error: `Synchronization aborted: ${divergence.reason}`,
      };
    }

    const peerH = BigInt(peerStatus.currentHeight);
    if (peerH <= localHeight) {
      // Peer is not ahead
      this.peerRegistry.updateHealth(peerNodeId, { syncState: 'IDLE' });
      return { success: true, blocksSynced: 0 };
    }

    this.peerRegistry.updateHealth(peerNodeId, { syncState: 'SYNCING' });

    let currentFetchHeight = localHeight + 1n;
    let totalSynced = 0;

    while (currentFetchHeight <= peerH) {
      const payload: ChainRequestPayload = {
        fromHeight: currentFetchHeight.toString(),
        limit: MAX_BLOCKS_PER_SYNC_REQUEST,
      };

      const requestEnv = createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CHAIN_REQUEST',
        chainId: this.chainId,
        payload,
      });

      const responseEnv = await this.transport.sendMessage(peerNodeId, requestEnv);

      if (!responseEnv) {
        this.peerRegistry.updateHealth(peerNodeId, { syncState: 'ERROR', isReachable: false });
        return {
          success: false,
          blocksSynced: totalSynced,
          error: `Failed to receive CHAIN_RESPONSE from peer '${peerNodeId}'`,
        };
      }

      // Verify response envelope signature and key validity
      const envVal = verifyNetworkEnvelope(responseEnv, this.nodeRegistry, this.chainId);
      if (!envVal.valid) {
        this.peerRegistry.updateHealth(peerNodeId, { syncState: 'ERROR' });
        return {
          success: false,
          blocksSynced: totalSynced,
          error: `Peer CHAIN_RESPONSE envelope verification failed: ${envVal.reason}`,
        };
      }

      if (responseEnv.senderNodeId !== peerNodeId) {
        this.peerRegistry.updateHealth(peerNodeId, { syncState: 'ERROR' });
        return {
          success: false,
          blocksSynced: totalSynced,
          error: `Sender node ID mismatch: envelope from '${responseEnv.senderNodeId}', expected '${peerNodeId}'`,
        };
      }

      const chainPayload: ChainResponsePayload = responseEnv.payload as ChainResponsePayload;
      const blocks: LedgerBlock[] = chainPayload.blocks || [];

      if (blocks.length === 0) {
        break; // No more blocks returned
      }

      // Verify snapshot in memory before applying to local ledger
      const localParent = await this.ledgerEngine.getBlockByHeight(currentFetchHeight - 1n);
      const snapshotVal = this.verifyPeerChainSnapshot(blocks, localParent);

      if (!snapshotVal.valid) {
        this.peerRegistry.updateHealth(peerNodeId, { syncState: 'DIVERGED' });
        return {
          success: false,
          blocksSynced: totalSynced,
          divergence: {
            diverged: true,
            code: 'INVALID_REMOTE_BLOCK',
            reason: snapshotVal.reason,
          },
          error: `Peer chain snapshot validation failed: ${snapshotVal.reason}`,
        };
      }

      // Sequentially append validated blocks to local ledger
      for (const block of blocks) {
        const appendResult = await this.ledgerEngine.appendBlock(block);
        if (!appendResult.valid) {
          this.peerRegistry.updateHealth(peerNodeId, { syncState: 'DIVERGED' });
          return {
            success: false,
            blocksSynced: totalSynced,
            divergence: {
              diverged: true,
              code: 'BLOCK_APPEND_REJECTED',
              reason: appendResult.reason,
            },
            error: `Failed to append remote block height ${block.header.height}: ${appendResult.reason}`,
          };
        }
        totalSynced++;
        currentFetchHeight++;
      }
    }

    const newLatest = await this.ledgerEngine.getLatestBlock();
    const newHeight = await this.ledgerEngine.getHeight();

    this.peerRegistry.updateHealth(peerNodeId, {
      syncState: 'IDLE',
      currentHeight: newHeight.toString(),
      latestBlockHash: newLatest?.blockHash || '',
      lastContactAt: new Date().toISOString(),
    });

    return { success: true, blocksSynced: totalSynced };
  }
}
