/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/transaction.ts
 *
 * Transaction Domain Logic & Signature Enforcement
 */

import { canonicalSerialize } from './serialization';
import { hashSha256, signDataHex, verifyDataSignatureHex } from './crypto';
import {
  LedgerTransaction,
  LedgerNodeIdentity,
  TransactionSignature,
  TransactionType,
  VerificationResult,
} from './types';

export interface CreateTransactionParams {
  chainId: string;
  txType: TransactionType;
  originatingNode: LedgerNodeIdentity['nodeId'];
  nonce: number;
  payload: Record<string, any>;
  timestamp?: string;
  version?: string;
}

/**
 * Compute canonical content string for transaction hashing & signing
 * (Excludes txId and signatures array)
 */
export function computeCanonicalTransactionData(
  tx: Omit<LedgerTransaction, 'txId' | 'signatures'>,
): string {
  const content = {
    chainId: tx.chainId,
    txType: tx.txType,
    originatingNode: tx.originatingNode,
    nonce: tx.nonce,
    timestamp: tx.timestamp,
    version: tx.version,
    payload: tx.payload,
  };

  return canonicalSerialize(content);
}

/**
 * Compute deterministic transaction ID (SHA-256 hash of canonical content)
 */
export function computeTransactionHash(
  tx: Omit<LedgerTransaction, 'txId' | 'signatures'>,
): string {
  const canonicalData = computeCanonicalTransactionData(tx);
  return hashSha256(canonicalData);
}

/**
 * Create a new unsigned LedgerTransaction with deterministic txId
 */
export function createLedgerTransaction(params: CreateTransactionParams): LedgerTransaction {
  const timestamp = params.timestamp || new Date().toISOString();
  const version = params.version || '1.0';

  const txBase = {
    chainId: params.chainId,
    txType: params.txType,
    originatingNode: params.originatingNode,
    nonce: params.nonce,
    timestamp,
    version,
    payload: params.payload,
  };

  const txId = computeTransactionHash(txBase);

  return {
    ...txBase,
    txId,
    signatures: [],
  };
}

/**
 * Sign a transaction using a node's ECDSA secp256k1 private key
 */
export function signTransaction(
  tx: LedgerTransaction,
  nodeIdentity: LedgerNodeIdentity,
): LedgerTransaction {
  if (!nodeIdentity.privateKeyPem) {
    throw new Error(`Cannot sign transaction: Node '${nodeIdentity.nodeId}' lacks a private key`);
  }

  const canonicalData = computeCanonicalTransactionData(tx);
  const signatureHex = signDataHex(canonicalData, nodeIdentity.privateKeyPem);

  const newSignature: TransactionSignature = {
    nodeId: nodeIdentity.nodeId,
    publicKeyPem: nodeIdentity.publicKeyPem,
    signatureHex,
    signedAt: new Date().toISOString(),
  };

  // Prevent duplicate signature entries for same nodeId
  const filteredSignatures = tx.signatures.filter((s) => s.nodeId !== nodeIdentity.nodeId);

  return {
    ...tx,
    signatures: [...filteredSignatures, newSignature],
  };
}

/**
 * Verify internal consistency and signatures of a LedgerTransaction
 */
export function verifyTransaction(tx: LedgerTransaction): VerificationResult {
  // 1. Verify txId matches recomputed content hash
  const expectedTxId = computeTransactionHash(tx);
  if (tx.txId !== expectedTxId) {
    return {
      valid: false,
      code: 'INVALID_TX_ID',
      reason: `Transaction ID '${tx.txId}' does not match computed hash '${expectedTxId}'`,
    };
  }

  // 2. Verify signatures if present
  const canonicalData = computeCanonicalTransactionData(tx);

  for (const sig of tx.signatures) {
    const isValid = verifyDataSignatureHex(canonicalData, sig.signatureHex, sig.publicKeyPem);
    if (!isValid) {
      return {
        valid: false,
        code: 'INVALID_SIGNATURE',
        reason: `Signature verification failed for node '${sig.nodeId}' on transaction '${tx.txId}'`,
        details: { nodeId: sig.nodeId, txId: tx.txId },
      };
    }
  }

  return { valid: true };
}
