/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/ledger-store.interface.ts
 *
 * Ledger Persistence Abstraction Interface
 */

import { LedgerBlock, LedgerTransaction } from './types';

export interface ILedgerStore {
  initialize(): Promise<LedgerBlock>;
  appendBlock(block: LedgerBlock): Promise<void>;
  getBlockByHeight(height: bigint | string): Promise<LedgerBlock | null>;
  getBlockByHash(hash: string): Promise<LedgerBlock | null>;
  getTransaction(txId: string): Promise<LedgerTransaction | null>;
  getLatestBlock(): Promise<LedgerBlock | null>;
  getChain(): Promise<LedgerBlock[]>;
  getHeight(): Promise<bigint>;
  hasTransaction(txId: string): Promise<boolean>;
  clear(): Promise<void>;
}
