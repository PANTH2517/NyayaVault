/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/types.ts
 *
 * Core Domain Types & Data Contracts for Sub-Phase 1D PoA Consensus
 */

import { LedgerBlock, NodeType } from '../ledger/types';

export type ProposalState =
  | 'PROPOSED'
  | 'ENDORSEMENT_COLLECTION'
  | 'QUORUM_REACHED'
  | 'COMMITTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'DIVERGED';

export interface ConsensusPolicy {
  policyId: string;
  policyVersion: string;
  name: string;
  minThreshold: number;
  requiredNodeIds: NodeType[];
  eligibleNodes: NodeType[];
  proposerNodes: NodeType[];
  timeoutMs: number;
}

export interface BlockProposal {
  proposalId: string; // Canonical SHA-256 hash of proposal fields
  chainId: string;
  blockHeight: string;
  previousBlockHash: string;
  proposedBlockHash: string;
  proposerNodeId: NodeType;
  proposerKeyVersion: number;
  proposerKeyFingerprint: string;
  proposalTimestamp: string;
  expiresAt: string;
  merkleRoot: string;
  policyId: string;
  policyVersion: string;
  block: LedgerBlock;
  signatureHex: string;
}

export interface BlockEndorsement {
  endorsementId: string; // Canonical SHA-256 hash of endorsement content
  proposalId: string;
  chainId: string;
  blockHeight: string;
  previousBlockHash: string;
  blockHash: string;
  nodeId: NodeType;
  keyVersion: number;
  keyFingerprint: string;
  policyId: string;
  policyVersion: string;
  signedAt: string;
  signatureHex: string;
}

export interface EndorsementSignatureRecord {
  nodeId: NodeType;
  keyVersion: number;
  keyFingerprint: string;
  publicKeyPem: string;
  signatureHex: string;
  signedAt: string;
}

export interface PoAConsensusProof {
  consensusType: 'PROOF_OF_AUTHORITY';
  consensusVersion: string;
  proposalId: string;
  blockHash: string;
  chainId: string;
  blockHeight: string;
  policyId: string;
  policyVersion: string;
  requiredThreshold: number;
  requiredNodeIds: NodeType[];
  endorsingSignatures: EndorsementSignatureRecord[];
  collectedAt: string;
  commitTimestamp: string;
}

export interface ProposalStateRecord {
  proposal: BlockProposal;
  state: ProposalState;
  endorsements: Map<NodeType, BlockEndorsement>;
  proof?: PoAConsensusProof;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsensusConflictResult {
  hasConflict: boolean;
  code?: string;
  reason?: string;
  localHeight?: string;
  proposalHeight?: string;
  localBlockHash?: string;
  proposedBlockHash?: string;
}
