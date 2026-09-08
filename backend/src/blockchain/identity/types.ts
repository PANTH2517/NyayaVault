/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/types.ts
 *
 * Core Domain Types & Interfaces for Sub-Phase 1B Cryptographic Identities & Key Management
 */

export type NodeType = 'POLICE_NODE' | 'PROSECUTION_NODE' | 'COURT_NODE' | 'ADMIN_NODE';

export type KeyStatus = 'ACTIVE' | 'PENDING' | 'REVOKED';

export type SigningDomain =
  | 'NYAYAVAULT_TX_V1'
  | 'NYAYAVAULT_BLOCK_V1'
  | 'NYAYAVAULT_CONSENSUS_V1'
  | 'NYAYAVAULT_NODE_REGISTRATION_V1';

export interface NodeKeyRecord {
  version: number;
  publicKeyPem: string;
  fingerprint: string; // SHA-256 digest of normalized public key Pem
  status: KeyStatus;
  createdAt: string; // ISO 8601 UTC
  activatedAt?: string;
  revokedAt?: string;
}

export interface NodeIdentity {
  nodeId: NodeType;
  organization: string;
  currentVersion: number;
  keys: NodeKeyRecord[];
  privateKeysByVersion: Map<number, string>; // In-memory private key store
}

export interface PublicNodeIdentity {
  nodeId: NodeType;
  organization: string;
  currentVersion: number;
  activeKey: NodeKeyRecord;
  keys: NodeKeyRecord[];
}

export interface SignedDomainPayload {
  domain: SigningDomain;
  payloadHash: string;
  nodeId: NodeType;
  keyVersion: number;
  keyFingerprint: string;
  signatureHex: string;
  signedAt: string;
}
