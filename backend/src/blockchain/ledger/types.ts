/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/types.ts
 *
 * Core Domain Types & Interfaces for Sub-Phase 1A Standalone Cryptographic Ledger
 */

export type NodeType = 'POLICE_NODE' | 'PROSECUTION_NODE' | 'COURT_NODE' | 'ADMIN_NODE';

export type TransactionType =
  | 'EVIDENCE_ANCHOR'
  | 'AUDIT_CHECKPOINT'
  | 'CHAIN_OF_CUSTODY_CHANGE'
  | 'SECURITY_INCIDENT_ANCHOR';

export interface TransactionSignature {
  nodeId: string;
  publicKeyPem: string;
  signatureHex: string;
  signedAt: string;
}

export interface LedgerTransaction {
  txId: string; // Deterministically computed SHA-256 hash of canonical content
  chainId: string; // Network/Chain isolation identifier
  txType: TransactionType;
  originatingNode: NodeType;
  nonce: number;
  timestamp: string; // ISO 8601 UTC
  version: string; // Payload schema version
  payload: Record<string, any>;
  signatures: TransactionSignature[];
}

export interface LedgerBlockHeader {
  height: string; // BigInt represented as string for JSON safe transport
  chainId: string;
  version: string;
  previousBlockHash: string;
  merkleRoot: string;
  timestamp: string; // ISO 8601 UTC
  proposerNode: NodeType;
}

export interface ConsensusProof {
  consensusType: 'PROOF_OF_AUTHORITY';
  requiredThreshold: number;
  endorsingSignatures: any[];
  [key: string]: any;
}

export interface LedgerBlock {
  blockHash: string; // SHA-256 hash of canonical LedgerBlockHeader
  header: LedgerBlockHeader;
  transactions: LedgerTransaction[];
  consensusProof?: ConsensusProof;
}

export interface LedgerNodeIdentity {
  nodeId: NodeType;
  name: string;
  publicKeyPem: string;
  privateKeyPem?: string; // Private key kept in memory for signing operations
}

export interface LedgerState {
  chainId: string;
  height: string;
  latestBlockHash: string;
  totalTransactions: number;
  initializedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  code?: string;
  reason?: string;
  details?: Record<string, any>;
}
