/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/ledger-engine.ts
 *
 * Standalone Cryptographic Ledger Engine
 */

import { ILedgerStore } from './ledger-store.interface';
import { InMemoryLedgerStore } from './in-memory-ledger-store';
import { IConsensusEngine, DefaultPoAConsensusEngine } from './consensus-interface';
import { createGenesisBlock, validateBlockStructure } from './block';
import { verifyTransaction } from './transaction';
import { LedgerBlock, LedgerTransaction, VerificationResult } from './types';

export interface LedgerEngineOptions {
  store?: ILedgerStore;
  consensusEngine?: IConsensusEngine;
  chainId?: string;
}

export class LedgerEngine {
  private readonly store: ILedgerStore;
  private readonly consensusEngine: IConsensusEngine;
  private readonly chainId: string;
  private isInitialized = false;

  constructor(options: LedgerEngineOptions = {}) {
    this.store = options.store || new InMemoryLedgerStore();
    this.consensusEngine = options.consensusEngine || new DefaultPoAConsensusEngine();
    this.chainId = options.chainId || 'nyayavault-mainnet-1';
  }

  /**
   * Initialize the ledger with a deterministic genesis block if empty
   */
  async initialize(): Promise<LedgerBlock> {
    const currentHeight = await this.store.getHeight();

    if (currentHeight >= 0n) {
      this.isInitialized = true;
      const latest = await this.store.getLatestBlock();
      return latest!;
    }

    const genesis = createGenesisBlock(this.chainId);
    await this.store.appendBlock(genesis);
    this.isInitialized = true;
    return genesis;
  }

  /**
   * Append a new candidate block after thorough cryptographic & state validation
   */
  async appendBlock(block: LedgerBlock): Promise<VerificationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const latestBlock = await this.store.getLatestBlock();

    if (!latestBlock) {
      return {
        valid: false,
        code: 'UNINITIALIZED_LEDGER',
        reason: 'Ledger has no latest block',
      };
    }

    // 1. Validate block chain ID
    if (block.header.chainId !== this.chainId) {
      return {
        valid: false,
        code: 'CHAIN_ID_MISMATCH',
        reason: `Block chainId '${block.header.chainId}' does not match engine chainId '${this.chainId}'`,
      };
    }

    // 2. Validate structural integrity & link to latest block
    const structValidation = validateBlockStructure(block, latestBlock);
    if (!structValidation.valid) {
      return structValidation;
    }

    // 3. Validate PoA Consensus Endorsements
    const consensusValidation = this.consensusEngine.validateConsensusProof(
      block,
      block.consensusProof,
    );
    if (!consensusValidation.valid) {
      return consensusValidation;
    }

    // 4. Replay Protection: Ensure no contained transaction ID already exists in ledger
    for (const tx of block.transactions) {
      const exists = await this.store.hasTransaction(tx.txId);
      if (exists) {
        return {
          valid: false,
          code: 'DUPLICATE_TRANSACTION',
          reason: `Transaction ID '${tx.txId}' already exists in ledger`,
          details: { txId: tx.txId },
        };
      }
    }

    // 5. Commit block to persistent store
    try {
      await this.store.appendBlock(block);
    } catch (err: any) {
      return {
        valid: false,
        code: 'STORE_APPEND_FAILED',
        reason: err.message,
      };
    }

    return { valid: true };
  }

  /**
   * Verify complete cryptographic integrity of all blocks in the ledger
   */
  async verifyChain(): Promise<VerificationResult> {
    const chain = await this.store.getChain();

    if (chain.length === 0) {
      return { valid: true, details: { totalBlocks: 0 } };
    }

    // 1. Verify Genesis Block
    const genesis = chain[0];
    const expectedGenesis = createGenesisBlock(this.chainId);

    if (genesis.blockHash !== expectedGenesis.blockHash) {
      return {
        valid: false,
        code: 'CORRUPTED_GENESIS_BLOCK',
        reason: `Genesis block hash '${genesis.blockHash}' does not match expected genesis hash '${expectedGenesis.blockHash}'`,
      };
    }

    // Track processed txIds for replay detection
    const seenTxIds = new Set<string>();

    for (const tx of genesis.transactions) {
      seenTxIds.add(tx.txId.toLowerCase());
    }

    // 2. Verify sequential chain links
    for (let i = 1; i < chain.length; i++) {
      const prevBlock = chain[i - 1];
      const currBlock = chain[i];

      const validation = validateBlockStructure(currBlock, prevBlock);
      if (!validation.valid) {
        return {
          valid: false,
          code: 'CORRUPTED_CHAIN_LINK',
          reason: `Block at height ${currBlock.header.height} failed chain validation: ${validation.reason}`,
          details: { height: currBlock.header.height, innerError: validation },
        };
      }

      // Check consensus signatures
      const consensusVal = this.consensusEngine.validateConsensusProof(
        currBlock,
        currBlock.consensusProof,
      );
      if (!consensusVal.valid) {
        return {
          valid: false,
          code: 'CORRUPTED_CONSENSUS_PROOF',
          reason: `Block at height ${currBlock.header.height} failed consensus verification: ${consensusVal.reason}`,
        };
      }

      // Replay check across blocks
      for (const tx of currBlock.transactions) {
        const lowerId = tx.txId.toLowerCase();
        if (seenTxIds.has(lowerId)) {
          return {
            valid: false,
            code: 'DUPLICATE_TRANSACTION_IN_CHAIN',
            reason: `Replayed transaction '${tx.txId}' detected at height ${currBlock.header.height}`,
          };
        }
        seenTxIds.add(lowerId);
      }
    }

    return {
      valid: true,
      details: { totalBlocks: chain.length, totalTransactions: seenTxIds.size },
    };
  }

  async getLatestBlock(): Promise<LedgerBlock | null> {
    return this.store.getLatestBlock();
  }

  async getHeight(): Promise<bigint> {
    return this.store.getHeight();
  }

  async getBlockByHeight(height: bigint | string): Promise<LedgerBlock | null> {
    return this.store.getBlockByHeight(height);
  }

  async getBlockByHash(hash: string): Promise<LedgerBlock | null> {
    return this.store.getBlockByHash(hash);
  }

  async getTransaction(txId: string): Promise<LedgerTransaction | null> {
    return this.store.getTransaction(txId);
  }
}
