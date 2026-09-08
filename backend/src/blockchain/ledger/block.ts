/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/block.ts
 *
 * Block Domain Logic, Genesis Block, Block Forging & Validation
 */

import { canonicalSerialize } from './serialization';
import { hashSha256 } from './crypto';
import { buildMerkleTree } from './merkle';
import { verifyTransaction } from './transaction';
import {
  LedgerBlock,
  LedgerBlockHeader,
  LedgerTransaction,
  LedgerNodeIdentity,
  VerificationResult,
} from './types';

export const GENESIS_BLOCK_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

export interface ForgeBlockParams {
  previousBlock: LedgerBlock;
  transactions: LedgerTransaction[];
  proposerNode: LedgerNodeIdentity['nodeId'];
  timestamp?: string;
  version?: string;
}

/**
 * Compute canonical string representation of block header for hashing
 */
export function computeCanonicalBlockHeaderData(header: LedgerBlockHeader): string {
  const content = {
    height: header.height,
    chainId: header.chainId,
    version: header.version,
    previousBlockHash: header.previousBlockHash,
    merkleRoot: header.merkleRoot,
    timestamp: header.timestamp,
    proposerNode: header.proposerNode,
  };

  return canonicalSerialize(content);
}

/**
 * Compute deterministic block hash (SHA-256 hash of canonical header)
 */
export function computeBlockHash(header: LedgerBlockHeader): string {
  const canonicalData = computeCanonicalBlockHeaderData(header);
  return hashSha256(canonicalData);
}

/**
 * Construct the deterministic Genesis Block for a specific chainId
 */
export function createGenesisBlock(chainId = 'nyayavault-mainnet-1'): LedgerBlock {
  const header: LedgerBlockHeader = {
    height: '0',
    chainId,
    version: '1.0',
    previousBlockHash: GENESIS_BLOCK_HASH,
    merkleRoot: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: '2026-09-06T00:00:00.000Z',
    proposerNode: 'ADMIN_NODE',
  };

  const blockHash = computeBlockHash(header);

  return {
    blockHash,
    header,
    transactions: [],
  };
}

/**
 * Pure deterministic block forging function
 */
export function forgeBlock(params: ForgeBlockParams): LedgerBlock {
  const prevHeight = BigInt(params.previousBlock.header.height);
  const newHeight = (prevHeight + 1n).toString();
  const timestamp = params.timestamp || new Date().toISOString();
  const version = params.version || '1.0';

  // 1. Extract transaction hashes & compute Merkle root
  const txHashes = params.transactions.map((tx) => tx.txId);
  const { root: merkleRoot } = buildMerkleTree(txHashes);

  const header: LedgerBlockHeader = {
    height: newHeight,
    chainId: params.previousBlock.header.chainId,
    version,
    previousBlockHash: params.previousBlock.blockHash,
    merkleRoot,
    timestamp,
    proposerNode: params.proposerNode,
  };

  const blockHash = computeBlockHash(header);

  return {
    blockHash,
    header,
    transactions: [...params.transactions],
  };
}

/**
 * Validate block structural integrity and cryptographic linkage
 */
export function validateBlockStructure(
  block: LedgerBlock,
  previousBlock?: LedgerBlock,
): VerificationResult {
  // 1. Verify block hash matches recomputed header hash
  const expectedBlockHash = computeBlockHash(block.header);
  if (block.blockHash !== expectedBlockHash) {
    return {
      valid: false,
      code: 'INVALID_BLOCK_HASH',
      reason: `Block hash '${block.blockHash}' does not match computed header hash '${expectedBlockHash}'`,
    };
  }

  // 2. Verify Merkle root matches transactions
  const txHashes = block.transactions.map((tx) => tx.txId);
  const { root: expectedMerkleRoot } = buildMerkleTree(txHashes);
  if (block.header.merkleRoot !== expectedMerkleRoot) {
    return {
      valid: false,
      code: 'INVALID_MERKLE_ROOT',
      reason: `Block Merkle root '${block.header.merkleRoot}' does not match computed root '${expectedMerkleRoot}'`,
    };
  }

  // 3. Verify all contained transactions internally
  for (const tx of block.transactions) {
    const txValidation = verifyTransaction(tx);
    if (!txValidation.valid) {
      return {
        valid: false,
        code: 'INVALID_TRANSACTION_IN_BLOCK',
        reason: `Transaction '${tx.txId}' in block ${block.header.height} failed verification: ${txValidation.reason}`,
        details: txValidation.details,
      };
    }
  }

  // 4. Verify previous block linkage if previousBlock is provided
  if (previousBlock) {
    if (block.header.previousBlockHash !== previousBlock.blockHash) {
      return {
        valid: false,
        code: 'INVALID_PREVIOUS_HASH',
        reason: `Block ${block.header.height} previousBlockHash '${block.header.previousBlockHash}' does not match previous block hash '${previousBlock.blockHash}'`,
      };
    }

    const prevHeight = BigInt(previousBlock.header.height);
    const currHeight = BigInt(block.header.height);
    if (currHeight !== prevHeight + 1n) {
      return {
        valid: false,
        code: 'INVALID_HEIGHT',
        reason: `Block height ${currHeight} is not sequential after previous height ${prevHeight}`,
      };
    }
  }

  // 5. Verify proposer authorization
  const authorizedProposers = ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'];
  if (!authorizedProposers.includes(block.header.proposerNode)) {
    return {
      valid: false,
      code: 'UNAUTHORIZED_PROPOSER',
      reason: `Proposer node '${block.header.proposerNode}' is not an authorized block proposer`,
    };
  }

  return { valid: true };
}
