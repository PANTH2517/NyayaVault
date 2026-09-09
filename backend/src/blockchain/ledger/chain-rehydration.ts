/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/chain-rehydration.ts
 *
 * Deterministic Chain Rehydration & Fail-Closed Cryptographic Validation Service
 */

import { ILedgerStore } from './ledger-store.interface';
import { IConsensusEngine } from './consensus-interface';
import { computeBlockHash, createGenesisBlock } from './block';
import { buildMerkleTree } from './merkle';
import { verifyTransaction } from './transaction';
import { VerificationResult } from './types';

export class ChainRehydrationService {
  constructor(
    private readonly store: ILedgerStore,
    private readonly consensusEngine: IConsensusEngine,
    private readonly nodeId: string,
    private readonly chainId = 'nyayavault-mainnet-1',
  ) {}

  /**
   * Sequentially reload and cryptographically revalidate complete persisted chain
   */
  async rehydrateChain(): Promise<
    VerificationResult & {
      totalBlocksSynced?: number;
      currentHeight?: string;
      latestBlockHash?: string;
    }
  > {
    // 1. Get current tip height from store
    let height = await this.store.getHeight();

    if (height < 0n) {
      // Store is uninitialized: initialize genesis block safely
      const genesis = await this.store.initialize();
      return {
        valid: true,
        totalBlocksSynced: 1,
        currentHeight: '0',
        latestBlockHash: genesis.blockHash,
      };
    }

    // 2. Validate Genesis Block (Height 0)
    const genesisBlock = await this.store.getBlockByHeight(0n);
    if (!genesisBlock) {
      return {
        valid: false,
        code: 'GENESIS_MISSING',
        reason: `Node '${this.nodeId}' persisted store is missing required genesis block at height 0`,
      };
    }

    const expectedGenesis = createGenesisBlock(this.chainId);
    if (genesisBlock.blockHash !== expectedGenesis.blockHash) {
      return {
        valid: false,
        code: 'GENESIS_MISMATCH',
        reason: `Genesis block hash '${genesisBlock.blockHash}' does not match expected deterministic genesis '${expectedGenesis.blockHash}'`,
      };
    }

    const seenTxIds = new Set<string>();
    for (const tx of genesisBlock.transactions) {
      seenTxIds.add(tx.txId.toLowerCase());
    }

    // 3. Sequentially revalidate blocks from Height 1 to Tip
    for (let h = 1n; h <= height; h++) {
      const prevBlock = await this.store.getBlockByHeight(h - 1n);
      const currBlock = await this.store.getBlockByHeight(h);

      if (!currBlock) {
        return {
          valid: false,
          code: 'HEIGHT_GAP',
          reason: `Node '${this.nodeId}' missing block at height ${h} during rehydration`,
        };
      }

      if (!prevBlock) {
        return {
          valid: false,
          code: 'HEIGHT_GAP',
          reason: `Node '${this.nodeId}' missing previous block at height ${h - 1n} during rehydration`,
        };
      }

      // Height check
      if (currBlock.header.height !== h.toString()) {
        return {
          valid: false,
          code: 'DUPLICATE_HEIGHT',
          reason: `Block at height index ${h} contains conflicting height property '${currBlock.header.height}'`,
        };
      }

      // Previous block link check
      if (currBlock.header.previousBlockHash !== prevBlock.blockHash) {
        return {
          valid: false,
          code: 'PREVIOUS_HASH_MISMATCH',
          reason: `Block ${h} previousBlockHash '${currBlock.header.previousBlockHash}' does not match previous block hash '${prevBlock.blockHash}'`,
        };
      }

      // Header hash recomputation check
      const recomputedHash = computeBlockHash(currBlock.header);
      if (currBlock.blockHash !== recomputedHash) {
        return {
          valid: false,
          code: 'BLOCK_HASH_MISMATCH',
          reason: `Block ${h} blockHash '${currBlock.blockHash}' does not match recomputed header hash '${recomputedHash}'`,
        };
      }

      // Merkle root rebuild check
      const txHashes = currBlock.transactions.map((tx) => tx.txId);
      const { root: expectedMerkleRoot } = buildMerkleTree(txHashes);
      if (currBlock.header.merkleRoot !== expectedMerkleRoot) {
        return {
          valid: false,
          code: 'MERKLE_ROOT_MISMATCH',
          reason: `Block ${h} Merkle root '${currBlock.header.merkleRoot}' does not match recomputed root '${expectedMerkleRoot}'`,
        };
      }

      // Transaction internal verification & replay check
      for (const tx of currBlock.transactions) {
        if (this.consensusEngine && (this.consensusEngine as any).nodeRegistry) {
          const reg = (this.consensusEngine as any).nodeRegistry;
          for (const sig of tx.signatures) {
            if (!sig.publicKeyPem) {
              const endorsementKey = currBlock.consensusProof?.endorsingSignatures?.find(
                (e) => e.nodeId === sig.nodeId && Boolean(e.publicKeyPem),
              )?.publicKeyPem;

              if (endorsementKey) {
                sig.publicKeyPem = endorsementKey;
              } else {
                const activeKey = reg.getActiveKey(sig.nodeId);
                if (activeKey) {
                  sig.publicKeyPem = activeKey.publicKeyPem;
                }
              }
            }
          }
        }

        const txVal = verifyTransaction(tx);
        if (!txVal.valid) {
          return {
            valid: false,
            code: 'INVALID_TRANSACTION_IN_BLOCK',
            reason: `Transaction '${tx.txId}' in block ${h} failed verification: ${txVal.reason}`,
          };
        }

        const lowerId = tx.txId.toLowerCase();
        if (seenTxIds.has(lowerId)) {
          return {
            valid: false,
            code: 'DUPLICATE_TRANSACTION_IN_CHAIN',
            reason: `Duplicate transaction '${tx.txId}' detected at block height ${h}`,
          };
        }
        seenTxIds.add(lowerId);
      }

      // Consensus Proof Validation
      if (!currBlock.consensusProof) {
        return {
          valid: false,
          code: 'MISSING_CONSENSUS_PROOF',
          reason: `Block ${h} is missing required PoAConsensusProof`,
        };
      }

      const consensusVal = this.consensusEngine.validateConsensusProof(
        currBlock,
        currBlock.consensusProof,
      );
      if (!consensusVal.valid) {
        return {
          valid: false,
          code: 'INVALID_CONSENSUS_PROOF',
          reason: `Block ${h} failed PoA consensus proof verification: ${consensusVal.reason}`,
        };
      }
    }

    // 4. Verify Latest Block Tip Match
    const latestBlock = await this.store.getLatestBlock();
    if (height > 0n && (!latestBlock || latestBlock.header.height !== height.toString())) {
      return {
        valid: false,
        code: 'TIP_METADATA_MISMATCH',
        reason: `Node '${this.nodeId}' store tip height does not match highest verified block height ${height}`,
      };
    }

    return {
      valid: true,
      totalBlocksSynced: Number(height + 1n),
      currentHeight: height.toString(),
      latestBlockHash: latestBlock?.blockHash || genesisBlock.blockHash,
    };
  }
}
