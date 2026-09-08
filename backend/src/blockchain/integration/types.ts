/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/types.ts
 *
 * Types & Data Contracts for Sub-Phase 1F Application Integration
 */

import { RoleName, BlockchainAnchorStatus } from '@prisma/client';
import { NodeType } from '../ledger/types';

export type ApplicationEventType =
  | 'EVIDENCE_CREATED'
  | 'EVIDENCE_VERSION_CREATED'
  | 'EVIDENCE_APPROVED'
  | 'EVIDENCE_SEALED'
  | 'INTEGRITY_TAMPER_DETECTED'
  | 'AUDIT_CHECKPOINT';

export const ROLE_TO_NODE_MAP: Record<RoleName, NodeType> = {
  [RoleName.ADMIN]: 'ADMIN_NODE',
  [RoleName.INVESTIGATING_OFFICER]: 'POLICE_NODE',
  [RoleName.PROSECUTOR]: 'PROSECUTION_NODE',
  [RoleName.SUPERVISOR]: 'COURT_NODE',
};

export const EVENT_TO_POLICY_MAP: Record<ApplicationEventType, string> = {
  EVIDENCE_CREATED: 'STANDARD_ANCHOR',
  EVIDENCE_VERSION_CREATED: 'STANDARD_ANCHOR',
  EVIDENCE_APPROVED: 'STANDARD_ANCHOR',
  EVIDENCE_SEALED: 'SEALED_EVIDENCE',
  INTEGRITY_TAMPER_DETECTED: 'STANDARD_ANCHOR',
  AUDIT_CHECKPOINT: 'GOVERNANCE_CHECKPOINT',
};

export interface BlockchainAnchorIntentParams {
  eventType: ApplicationEventType;
  role?: RoleName;
  nodeId?: NodeType;
  caseId?: string;
  documentId?: string;
  versionId?: string;
  versionNumber?: number;
  auditSequenceNumber?: string | bigint;
  evidenceHash?: string;
  expectedHash?: string;
  actualHash?: string;
  previousVersionId?: string;
  incidentId?: string;
  approvalId?: string;
  metadata?: Record<string, any>;
}

export type VerificationResultCode =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'EVIDENCE_INTEGRITY_FAILURE'
  | 'INVALID'
  | 'PENDING'
  | 'NOT_ANCHORED'
  | 'CHAIN_UNAVAILABLE';

export interface ByteIntegrityResult {
  valid: boolean;
  tampered: boolean;
  expectedHash: string;
  actualHash: string;
  checkedAt: string;
  error?: string;
}

export interface BlockchainProofResult {
  valid: boolean;
  anchorStatus?: BlockchainAnchorStatus | string;
  blockHeight?: string;
  blockHash?: string;
  txId?: string;
  policyId?: string;
  originatingNode?: string;
  reason?: string;
  details?: Record<string, any>;
}

export interface ProvenanceTimelineEvent {
  timestamp: string;
  sequenceNumber: string;
  eventHash: string;
  eventType: string;
  action: string;
  originatingNode?: string;
  anchorStatus?: string;
  blockchainTxId?: string;
  blockHeight?: string;
  blockHash?: string;
  consensusPolicy?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export interface EvidenceProvenanceResponse {
  status: VerificationResultCode;
  versionId: string;
  documentId: string;
  caseId: string;
  versionNumber: number;
  trustedSha256: string;
  byteIntegrity: ByteIntegrityResult;
  blockchainProof: BlockchainProofResult;
  timeline: ProvenanceTimelineEvent[];
}

export interface EvidenceVerificationResponse {
  status: VerificationResultCode;
  versionId: string;
  documentId?: string;
  caseId?: string;
  trustedSha256: string;
  blockchainAnchorStatus?: BlockchainAnchorStatus;
  blockHeight?: string;
  blockHash?: string;
  blockchainTxId?: string;
  originatingNode?: string;
  policyId?: string;
  proofValid?: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export interface AuditVerificationResponse {
  status: VerificationResultCode;
  latestSequenceNumber: string;
  latestEventHash: string;
  blockchainAnchorStatus?: BlockchainAnchorStatus;
  blockHeight?: string;
  blockHash?: string;
  blockchainTxId?: string;
  proofValid?: boolean;
  reason?: string;
  details?: Record<string, any>;
}

