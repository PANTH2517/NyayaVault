/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/in-memory-ledger-store.ts
 *
 * In-Memory Implementation of ILedgerStore (For Engine Testing & Isolation)
 */

import { ILedgerStore } from './ledger-store.interface';
import { LedgerBlock, LedgerTransaction } from './types';
import { createGenesisBlock } from './block';

export class InMemoryLedgerStore implements ILedgerStore {
  private blocks: LedgerBlock[] = [];
  private blockByHash: Map<string, LedgerBlock> = new Map();
  private blockByHeight: Map<string, LedgerBlock> = new Map();
  private txById: Map<string, LedgerTransaction> = new Map();
  private readonly chainId: string;

  constructor(chainId = 'nyayavault-mainnet-1') {
    this.chainId = chainId;
  }

  async initialize(): Promise<LedgerBlock> {
    const latest = await this.getLatestBlock();
    if (latest) {
      return latest;
    }
    const genesis = createGenesisBlock(this.chainId);
    await this.appendBlock(genesis);
    return genesis;
  }

  async appendBlock(block: LedgerBlock): Promise<void> {
    const heightStr = BigInt(block.header.height).toString();

    if (this.blockByHeight.has(heightStr)) {
      throw new Error(`Block at height ${heightStr} already exists in store`);
    }

    if (this.blockByHash.has(block.blockHash)) {
      throw new Error(`Block with hash '${block.blockHash}' already exists in store`);
    }

    for (const tx of block.transactions) {
      if (this.txById.has(tx.txId.toLowerCase())) {
        throw new Error(`DUPLICATE_TRANSACTION: Transaction '${tx.txId}' already exists in ledger store.`);
      }
    }

    this.blocks.push(block);
    this.blockByHash.set(block.blockHash.toLowerCase(), block);
    this.blockByHeight.set(heightStr, block);

    for (const tx of block.transactions) {
      this.txById.set(tx.txId.toLowerCase(), tx);
    }
  }

  async getBlockByHeight(height: bigint | string): Promise<LedgerBlock | null> {
    const heightStr = BigInt(height).toString();
    return this.blockByHeight.get(heightStr) || null;
  }

  async getBlockByHash(hash: string): Promise<LedgerBlock | null> {
    return this.blockByHash.get(hash.toLowerCase()) || null;
  }

  async getTransaction(txId: string): Promise<LedgerTransaction | null> {
    return this.txById.get(txId.toLowerCase()) || null;
  }

  async getLatestBlock(): Promise<LedgerBlock | null> {
    if (this.blocks.length === 0) return null;
    return this.blocks[this.blocks.length - 1];
  }

  async getChain(): Promise<LedgerBlock[]> {
    return [...this.blocks];
  }

  async getHeight(): Promise<bigint> {
    if (this.blocks.length === 0) return -1n;
    return BigInt(this.blocks[this.blocks.length - 1].header.height);
  }

  async hasTransaction(txId: string): Promise<boolean> {
    return this.txById.has(txId.toLowerCase());
  }

  async clear(): Promise<void> {
    this.blocks = [];
    this.blockByHash.clear();
    this.blockByHeight.clear();
    this.txById.clear();
  }
}
