/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/endorsement-signer.ts
 *
 * Cryptographic Serialization, Proposal Hashing & Domain Signing Engine
 */

import { canonicalSerialize } from '../ledger/serialization';
import { hashSha256 } from '../ledger/crypto';
import { signDomainPayload, verifyDomainPayload } from '../identity/domain-signer';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity, NodeType } from '../identity/types';
import { LedgerBlock, VerificationResult } from '../ledger/types';
import { computeBlockHash, validateBlockStructure } from '../ledger/block';
import { BlockEndorsement, BlockProposal } from './types';

export const CONSENSUS_DOMAIN_NAME = 'NYAYAVAULT_CONSENSUS_V1';

export interface CreateProposalParams {
  proposerNode: NodeIdentity;
  block: LedgerBlock;
  policyId: string;
  policyVersion?: string;
  chainId: string;
  timeoutMs?: number;
  proposalTimestamp?: string;
}

export interface CreateEndorsementParams {
  endorserNode: NodeIdentity;
  proposal: BlockProposal;
}

/**
 * Compute canonical string representation of block proposal content
 */
export function computeCanonicalProposalData(proposal: {
  chainId: string;
  blockHeight: string;
  previousBlockHash: string;
  proposedBlockHash: string;
  proposerNodeId: NodeType;
  proposerKeyVersion: number;
  proposalTimestamp: string;
  expiresAt: string;
  merkleRoot: string;
  policyId: string;
  policyVersion: string;
}): string {
  const content = {
    chainId: proposal.chainId,
    blockHeight: proposal.blockHeight,
    previousBlockHash: proposal.previousBlockHash,
    proposedBlockHash: proposal.proposedBlockHash,
    proposerNodeId: proposal.proposerNodeId,
    proposerKeyVersion: proposal.proposerKeyVersion,
    proposalTimestamp: proposal.proposalTimestamp,
    expiresAt: proposal.expiresAt,
    merkleRoot: proposal.merkleRoot,
    policyId: proposal.policyId,
    policyVersion: proposal.policyVersion,
  };

  return canonicalSerialize(content);
}

/**
 * Compute deterministic proposal ID (SHA-256 hash of canonical proposal data)
 */
export function computeProposalId(proposal: {
  chainId: string;
  blockHeight: string;
  previousBlockHash: string;
  proposedBlockHash: string;
  proposerNodeId: NodeType;
  proposerKeyVersion: number;
  proposalTimestamp: string;
  expiresAt: string;
  merkleRoot: string;
  policyId: string;
  policyVersion: string;
}): string {
  const canonicalData = computeCanonicalProposalData(proposal);
  return hashSha256(canonicalData);
}

/**
 * Create and sign a secure BlockProposal
 */
export function createBlockProposal(params: CreateProposalParams): BlockProposal {
  const activeKey = params.proposerNode.keys.find(
    (k) => k.version === params.proposerNode.currentVersion && k.status === 'ACTIVE',
  );

  if (!activeKey) {
    throw new Error(
      `Cannot create proposal: Proposer node '${params.proposerNode.nodeId}' has no active key for version ${params.proposerNode.currentVersion}`,
    );
  }

  const proposalTimestamp = params.proposalTimestamp || new Date().toISOString();
  const timeoutMs = params.timeoutMs || 60000;
  const expiresAt = new Date(new Date(proposalTimestamp).getTime() + timeoutMs).toISOString();
  const policyVersion = params.policyVersion || '1.0';
  const proposedBlockHash = params.block.blockHash || computeBlockHash(params.block.header);


  const proposalBase = {
    chainId: params.chainId,
    blockHeight: params.block.header.height,
    previousBlockHash: params.block.header.previousBlockHash,
    proposedBlockHash,
    proposerNodeId: params.proposerNode.nodeId,
    proposerKeyVersion: params.proposerNode.currentVersion,
    proposalTimestamp,
    expiresAt,
    merkleRoot: params.block.header.merkleRoot,
    policyId: params.policyId,
    policyVersion,
  };

  const proposalId = computeProposalId(proposalBase);
  const canonicalData = computeCanonicalProposalData(proposalBase);
  const signed = signDomainPayload(params.proposerNode, CONSENSUS_DOMAIN_NAME, canonicalData);

  return {
    ...proposalBase,
    proposalId,
    proposerKeyFingerprint: activeKey.fingerprint,
    block: params.block,
    signatureHex: signed.signatureHex,
  };
}

/**
 * Verify cryptographic validity and proposer identity of a BlockProposal
 */
export function verifyBlockProposal(
  proposal: BlockProposal,
  nodeRegistry: INodeRegistry,
  expectedChainId?: string,
): VerificationResult {
  // 1. Verify chain ID match
  if (expectedChainId && proposal.chainId !== expectedChainId) {
    return {
      valid: false,
      code: 'CHAIN_ID_MISMATCH',
      reason: `Proposal chainId '${proposal.chainId}' does not match expected '${expectedChainId}'`,
    };
  }

  // 2. Verify proposed block hash match
  const computedBlockHash = computeBlockHash(proposal.block.header);
  if (proposal.proposedBlockHash !== computedBlockHash) {
    return {
      valid: false,
      code: 'PROPOSED_HASH_MISMATCH',
      reason: `Proposal blockHash '${proposal.proposedBlockHash}' does not match recomputed block header hash '${computedBlockHash}'`,
    };
  }

  // 3. Verify structural integrity of contained block (Merkle root & transaction hashes)
  const structVal = validateBlockStructure(proposal.block);
  if (!structVal.valid) {
    return structVal;
  }

  // 3. Verify proposer registration
  const proposerNode = nodeRegistry.getNode(proposal.proposerNodeId);
  if (!proposerNode) {
    return {
      valid: false,
      code: 'UNREGISTERED_PROPOSER_NODE',
      reason: `Proposer node '${proposal.proposerNodeId}' is not registered in network topology`,
    };
  }

  // 4. Verify proposer key version & fingerprint
  const keyRecord = proposerNode.keys.find((k) => k.version === proposal.proposerKeyVersion);
  if (!keyRecord) {
    return {
      valid: false,
      code: 'UNKNOWN_PROPOSER_KEY_VERSION',
      reason: `Key version ${proposal.proposerKeyVersion} not found for proposer node '${proposal.proposerNodeId}'`,
    };
  }

  if (keyRecord.status !== 'ACTIVE') {
    return {
      valid: false,
      code: 'REVOKED_PROPOSER_KEY',
      reason: `Proposer key version ${proposal.proposerKeyVersion} for node '${proposal.proposerNodeId}' is '${keyRecord.status}'`,
    };
  }

  if (keyRecord.fingerprint !== proposal.proposerKeyFingerprint) {
    return {
      valid: false,
      code: 'PROPOSER_FINGERPRINT_MISMATCH',
      reason: `Proposer key fingerprint mismatch for node '${proposal.proposerNodeId}'`,
    };
  }

  // 5. Verify secp256k1 domain signature over canonical proposal data
  const canonicalData = computeCanonicalProposalData({
    chainId: proposal.chainId,
    blockHeight: proposal.blockHeight,
    previousBlockHash: proposal.previousBlockHash,
    proposedBlockHash: proposal.proposedBlockHash,
    proposerNodeId: proposal.proposerNodeId,
    proposerKeyVersion: proposal.proposerKeyVersion,
    proposalTimestamp: proposal.proposalTimestamp,
    expiresAt: proposal.expiresAt,
    merkleRoot: proposal.merkleRoot,
    policyId: proposal.policyId,
    policyVersion: proposal.policyVersion,
  });

  const isSigValid = verifyDomainPayload(
    keyRecord.publicKeyPem,
    CONSENSUS_DOMAIN_NAME,
    canonicalData,
    proposal.signatureHex,
  );

  if (!isSigValid) {
    return {
      valid: false,
      code: 'INVALID_PROPOSAL_SIGNATURE',
      reason: `Proposal domain signature verification failed for proposer '${proposal.proposerNodeId}'`,
    };
  }

  // 6. Verify proposal expiry
  if (proposal.expiresAt) {
    const expiresMs = new Date(proposal.expiresAt).getTime();
    if (!isNaN(expiresMs) && Date.now() > expiresMs) {
      return {
        valid: false,
        code: 'PROPOSAL_EXPIRED',
        reason: `Block proposal '${proposal.proposalId}' has expired (expired at ${proposal.expiresAt})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Compute canonical string representation of block endorsement content
 */
export function computeCanonicalEndorsementData(endorsement: {
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
}): string {
  const content = {
    proposalId: endorsement.proposalId,
    chainId: endorsement.chainId,
    blockHeight: endorsement.blockHeight,
    previousBlockHash: endorsement.previousBlockHash,
    blockHash: endorsement.blockHash,
    nodeId: endorsement.nodeId,
    keyVersion: endorsement.keyVersion,
    keyFingerprint: endorsement.keyFingerprint,
    policyId: endorsement.policyId,
    policyVersion: endorsement.policyVersion,
    signedAt: endorsement.signedAt,
  };

  return canonicalSerialize(content);
}

/**
 * Compute deterministic endorsement ID (SHA-256 hash of canonical endorsement data)
 */
export function computeEndorsementId(endorsement: {
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
}): string {
  const canonicalData = computeCanonicalEndorsementData(endorsement);
  return hashSha256(canonicalData);
}

/**
 * Create and sign a secure BlockEndorsement bound to a specific BlockProposal
 */
export function createBlockEndorsement(params: CreateEndorsementParams): BlockEndorsement {
  const activeKey = params.endorserNode.keys.find(
    (k) => k.version === params.endorserNode.currentVersion && k.status === 'ACTIVE',
  );

  if (!activeKey) {
    throw new Error(
      `Cannot create endorsement: Node '${params.endorserNode.nodeId}' has no active key for version ${params.endorserNode.currentVersion}`,
    );
  }

  const signedAt = new Date().toISOString();

  const endorsementBase = {
    proposalId: params.proposal.proposalId,
    chainId: params.proposal.chainId,
    blockHeight: params.proposal.blockHeight,
    previousBlockHash: params.proposal.previousBlockHash,
    blockHash: params.proposal.proposedBlockHash,
    nodeId: params.endorserNode.nodeId,
    keyVersion: params.endorserNode.currentVersion,
    keyFingerprint: activeKey.fingerprint,
    policyId: params.proposal.policyId,
    policyVersion: params.proposal.policyVersion,
    signedAt,
  };

  const endorsementId = computeEndorsementId(endorsementBase);
  const canonicalData = computeCanonicalEndorsementData(endorsementBase);
  const signed = signDomainPayload(params.endorserNode, CONSENSUS_DOMAIN_NAME, canonicalData);

  return {
    ...endorsementBase,
    endorsementId,
    signatureHex: signed.signatureHex,
  };
}

/**
 * Verify cryptographic validity and strict proposal binding of a BlockEndorsement
 */
export function verifyBlockEndorsement(
  endorsement: BlockEndorsement,
  proposal: BlockProposal,
  nodeRegistry: INodeRegistry,
  expectedChainId?: string,
): VerificationResult {
  // 1. Verify strict binding to proposal parameters
  if (endorsement.proposalId !== proposal.proposalId) {
    return {
      valid: false,
      code: 'PROPOSAL_ID_MISMATCH',
      reason: `Endorsement proposalId '${endorsement.proposalId}' does not match expected proposalId '${proposal.proposalId}'`,
    };
  }

  if (endorsement.blockHash !== proposal.proposedBlockHash) {
    return {
      valid: false,
      code: 'BLOCK_HASH_MISMATCH',
      reason: `Endorsement blockHash '${endorsement.blockHash}' does not match proposal blockHash '${proposal.proposedBlockHash}'`,
    };
  }

  if (endorsement.blockHeight !== proposal.blockHeight) {
    return {
      valid: false,
      code: 'BLOCK_HEIGHT_MISMATCH',
      reason: `Endorsement height '${endorsement.blockHeight}' does not match proposal height '${proposal.blockHeight}'`,
    };
  }

  if (endorsement.previousBlockHash !== proposal.previousBlockHash) {
    return {
      valid: false,
      code: 'PREVIOUS_HASH_MISMATCH',
      reason: `Endorsement previousBlockHash '${endorsement.previousBlockHash}' does not match proposal previousBlockHash '${proposal.previousBlockHash}'`,
    };
  }

  if (expectedChainId && endorsement.chainId !== expectedChainId) {
    return {
      valid: false,
      code: 'CHAIN_ID_MISMATCH',
      reason: `Endorsement chainId '${endorsement.chainId}' does not match expected '${expectedChainId}'`,
    };
  }

  // 2. Verify endorser node registration
  const endorserNode = nodeRegistry.getNode(endorsement.nodeId);
  if (!endorserNode) {
    return {
      valid: false,
      code: 'UNREGISTERED_ENDORSER_NODE',
      reason: `Endorser node '${endorsement.nodeId}' is not registered in network topology`,
    };
  }

  // 3. Verify endorser key version & fingerprint
  const keyRecord = endorserNode.keys.find((k) => k.version === endorsement.keyVersion);
  if (!keyRecord) {
    return {
      valid: false,
      code: 'UNKNOWN_ENDORSER_KEY_VERSION',
      reason: `Key version ${endorsement.keyVersion} not found for endorser node '${endorsement.nodeId}'`,
    };
  }

  if (keyRecord.status !== 'ACTIVE') {
    return {
      valid: false,
      code: 'REVOKED_ENDORSER_KEY',
      reason: `Endorser key version ${endorsement.keyVersion} for node '${endorsement.nodeId}' is '${keyRecord.status}'`,
    };
  }

  if (keyRecord.fingerprint !== endorsement.keyFingerprint) {
    return {
      valid: false,
      code: 'ENDORSER_FINGERPRINT_MISMATCH',
      reason: `Endorser key fingerprint mismatch for node '${endorsement.nodeId}'`,
    };
  }

  // 4. Verify secp256k1 domain signature over canonical endorsement data
  const canonicalData = computeCanonicalEndorsementData({
    proposalId: endorsement.proposalId,
    chainId: endorsement.chainId,
    blockHeight: endorsement.blockHeight,
    previousBlockHash: endorsement.previousBlockHash,
    blockHash: endorsement.blockHash,
    nodeId: endorsement.nodeId,
    keyVersion: endorsement.keyVersion,
    keyFingerprint: endorsement.keyFingerprint,
    policyId: endorsement.policyId,
    policyVersion: endorsement.policyVersion,
    signedAt: endorsement.signedAt,
  });

  const isSigValid = verifyDomainPayload(
    keyRecord.publicKeyPem,
    CONSENSUS_DOMAIN_NAME,
    canonicalData,
    endorsement.signatureHex,
  );

  if (!isSigValid) {
    return {
      valid: false,
      code: 'INVALID_ENDORSEMENT_SIGNATURE',
      reason: `Endorsement domain signature verification failed for node '${endorsement.nodeId}'`,
    };
  }

  return { valid: true };
}
