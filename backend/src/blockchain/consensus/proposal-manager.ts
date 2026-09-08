/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/proposal-manager.ts
 *
 * Consensus Proposal Lifecycle State Machine & Endorsement Collector Unit
 */

import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity, NodeType } from '../identity/types';
import { LedgerBlock, VerificationResult } from '../ledger/types';
import { ConsensusPolicyRegistry } from './policy-registry';
import {
  createBlockEndorsement,
  createBlockProposal,
  verifyBlockEndorsement,
  verifyBlockProposal,
} from './endorsement-signer';
import {
  BlockEndorsement,
  BlockProposal,
  EndorsementSignatureRecord,
  PoAConsensusProof,
  ProposalState,
  ProposalStateRecord,
} from './types';

export interface ProposalManagerConfig {
  localNode: NodeIdentity;
  nodeRegistry: INodeRegistry;
  policyRegistry?: ConsensusPolicyRegistry;
  chainId: string;
}

export class ProposalManager {
  private readonly localNode: NodeIdentity;
  private readonly nodeRegistry: INodeRegistry;
  private readonly policyRegistry: ConsensusPolicyRegistry;
  private readonly chainId: string;

  private proposals: Map<string, ProposalStateRecord> = new Map();
  private proposalByBlockHash: Map<string, string> = new Map();
  private proposalsByHeight: Map<string, string[]> = new Map();

  constructor(config: ProposalManagerConfig) {
    this.localNode = config.localNode;
    this.nodeRegistry = config.nodeRegistry;
    this.policyRegistry = config.policyRegistry || new ConsensusPolicyRegistry();
    this.chainId = config.chainId;
  }

  /**
   * Detect if a conflicting proposal exists at the specified height with a different block hash
   */
  detectHeightConflict(blockHeight: string, proposedBlockHash: string): {
    hasConflict: boolean;
    code?: string;
    reason?: string;
    localHeight?: string;
    proposalHeight?: string;
    localBlockHash?: string;
    proposedBlockHash?: string;
  } {
    const existingIds = this.proposalsByHeight.get(blockHeight) || [];
    for (const propId of existingIds) {
      const rec = this.proposals.get(propId);
      if (
        rec &&
        rec.state !== 'EXPIRED' &&
        rec.state !== 'REJECTED' &&
        rec.proposal.proposedBlockHash !== proposedBlockHash
      ) {
        return {
          hasConflict: true,
          code: 'CONFLICTING_PROPOSALS_SAME_HEIGHT',
          reason: `Conflicting consensus proposal '${propId}' already exists at height ${blockHeight} with hash '${rec.proposal.proposedBlockHash}'`,
          localHeight: blockHeight,
          proposalHeight: blockHeight,
          localBlockHash: rec.proposal.proposedBlockHash,
          proposedBlockHash,
        };
      }
    }
    return { hasConflict: false };
  }

  /**
   * Propose a new block for network multi-signature endorsement
   */
  createProposal(
    block: LedgerBlock,
    policyId = 'STANDARD_ANCHOR',
    timeoutMs = 60000,
  ): VerificationResult & { proposal?: BlockProposal } {
    // 1. Verify proposer authorization
    const permVal = this.policyRegistry.validateProposalPermission(
      this.localNode.nodeId,
      policyId,
    );
    if (!permVal.valid) {
      return permVal;
    }

    // 2. Prevent proposal for duplicate block hash
    if (this.proposalByBlockHash.has(block.blockHash)) {
      return {
        valid: false,
        code: 'DUPLICATE_PROPOSAL_BLOCK_HASH',
        reason: `A consensus proposal already exists for block hash '${block.blockHash}'`,
      };
    }

    // 3. Detect conflicting proposal for same height
    const conflict = this.detectHeightConflict(block.header.height, block.blockHash);
    if (conflict.hasConflict) {
      return {
        valid: false,
        code: conflict.code || 'CONFLICTING_PROPOSALS_SAME_HEIGHT',
        reason: conflict.reason,
      };
    }

    // 4. Create signed block proposal envelope
    const proposal = createBlockProposal({
      proposerNode: this.localNode,
      block,
      policyId,
      chainId: this.chainId,
      timeoutMs,
    });

    const record: ProposalStateRecord = {
      proposal,
      state: 'PROPOSED',
      endorsements: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.proposals.set(proposal.proposalId, record);
    this.proposalByBlockHash.set(block.blockHash, proposal.proposalId);

    const heightList = this.proposalsByHeight.get(block.header.height) || [];
    heightList.push(proposal.proposalId);
    this.proposalsByHeight.set(block.header.height, heightList);

    return { valid: true, proposal };
  }


  /**
   * Process and validate an incoming proposal received from a remote peer
   */
  receiveProposal(proposal: BlockProposal): VerificationResult {
    this.checkExpirations();

    // 1. Verify expiration
    if (new Date() > new Date(proposal.expiresAt)) {
      return {
        valid: false,
        code: 'EXPIRED_PROPOSAL',
        reason: `Proposal '${proposal.proposalId}' has expired at ${proposal.expiresAt}`,
      };
    }

    // 2. Verify chain ID
    if (proposal.chainId !== this.chainId) {
      return {
        valid: false,
        code: 'CHAIN_ID_MISMATCH',
        reason: `Proposal chainId '${proposal.chainId}' does not match expected '${this.chainId}'`,
      };
    }

    // 3. Verify proposer authorization
    const permVal = this.policyRegistry.validateProposalPermission(
      proposal.proposerNodeId,
      proposal.policyId,
    );
    if (!permVal.valid) {
      return permVal;
    }

    // 4. Verify proposal cryptographic signature & content
    const propVal = verifyBlockProposal(proposal, this.nodeRegistry, this.chainId);
    if (!propVal.valid) {
      return propVal;
    }

    // 5. Detect height conflict
    const conflict = this.detectHeightConflict(proposal.blockHeight, proposal.proposedBlockHash);
    if (conflict.hasConflict) {
      if (!this.proposals.has(proposal.proposalId)) {
        const record: ProposalStateRecord = {
          proposal,
          state: 'DIVERGED',
          endorsements: new Map(),
          reason: conflict.reason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.proposals.set(proposal.proposalId, record);
        this.proposalByBlockHash.set(proposal.proposedBlockHash, proposal.proposalId);
      }
      return {
        valid: false,
        code: conflict.code || 'CONFLICTING_PROPOSALS_SAME_HEIGHT',
        reason: conflict.reason,
      };
    }

    if (!this.proposals.has(proposal.proposalId)) {
      const record: ProposalStateRecord = {
        proposal,
        state: 'ENDORSEMENT_COLLECTION',
        endorsements: new Map(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.proposals.set(proposal.proposalId, record);
      this.proposalByBlockHash.set(proposal.proposedBlockHash, proposal.proposalId);

      const heightList = this.proposalsByHeight.get(proposal.blockHeight) || [];
      heightList.push(proposal.proposalId);
      this.proposalsByHeight.set(proposal.blockHeight, heightList);
    }

    return { valid: true };
  }

  /**
   * Generate an endorsement for a proposal if authorized
   */
  createEndorsement(proposalId: string): VerificationResult & { endorsement?: BlockEndorsement } {
    const record = this.proposals.get(proposalId);

    if (!record) {
      return {
        valid: false,
        code: 'UNKNOWN_PROPOSAL',
        reason: `Proposal '${proposalId}' not found`,
      };
    }

    if (record.state === 'EXPIRED' || record.state === 'REJECTED') {
      return {
        valid: false,
        code: 'INVALID_PROPOSAL_STATE',
        reason: `Cannot endorse proposal '${proposalId}' in state '${record.state}'`,
      };
    }

    if (new Date() > new Date(record.proposal.expiresAt)) {
      record.state = 'EXPIRED';
      record.updatedAt = new Date().toISOString();
      return {
        valid: false,
        code: 'EXPIRED_PROPOSAL',
        reason: `Proposal '${proposalId}' has expired`,
      };
    }

    const permVal = this.policyRegistry.validateEndorsementPermission(
      this.localNode.nodeId,
      record.proposal.policyId,
    );

    if (!permVal.valid) {
      return permVal;
    }

    const endorsement = createBlockEndorsement({
      endorserNode: this.localNode,
      proposal: record.proposal,
    });

    return { valid: true, endorsement };
  }

  /**
   * Register and evaluate an endorsement for a proposal
   */
  addEndorsement(
    endorsement: BlockEndorsement,
  ): VerificationResult & { proof?: PoAConsensusProof; state?: ProposalState } {
    this.checkExpirations();

    const record = this.proposals.get(endorsement.proposalId);

    if (!record) {
      return {
        valid: false,
        code: 'UNKNOWN_PROPOSAL',
        reason: `Proposal '${endorsement.proposalId}' not found`,
      };
    }

    if (record.state === 'COMMITTED') {
      return {
        valid: true,
        state: 'COMMITTED',
        proof: record.proof,
      };
    }

    if (record.state === 'EXPIRED' || record.state === 'REJECTED') {
      return {
        valid: false,
        code: 'INVALID_PROPOSAL_STATE',
        reason: `Cannot add endorsement to proposal '${endorsement.proposalId}' in state '${record.state}'`,
      };
    }

    // 1. Verify endorsement binding & cryptographic signature
    const endVal = verifyBlockEndorsement(
      endorsement,
      record.proposal,
      this.nodeRegistry,
      this.chainId,
    );

    if (!endVal.valid) {
      return endVal;
    }

    // 2. Signer Uniqueness Enforcement: Check if node already endorsed
    if (record.endorsements.has(endorsement.nodeId)) {
      return {
        valid: false,
        code: 'DUPLICATE_ENDORSER',
        reason: `Node '${endorsement.nodeId}' has already contributed an endorsement for proposal '${endorsement.proposalId}'`,
      };
    }

    record.endorsements.set(endorsement.nodeId, endorsement);
    record.updatedAt = new Date().toISOString();

    // 3. Evaluate Quorum Policy
    const policy = this.policyRegistry.getPolicy(record.proposal.policyId)!;
    const quorumVal = this.policyRegistry.evaluateQuorum(
      record.proposal.policyId,
      Array.from(record.endorsements.values()),
    );

    if (quorumVal.valid) {
      // Quorum Reached -> Build strongly-typed PoAConsensusProof
      record.state = 'QUORUM_REACHED';

      const endorsingSignatures: EndorsementSignatureRecord[] = Array.from(
        record.endorsements.values(),
      ).map((e) => {
        const endorserNode = this.nodeRegistry.getNode(e.nodeId)!;
        const activeKey = endorserNode.keys.find((k) => k.version === e.keyVersion)!;

        return {
          nodeId: e.nodeId,
          keyVersion: e.keyVersion,
          keyFingerprint: e.keyFingerprint,
          publicKeyPem: activeKey.publicKeyPem,
          signatureHex: e.signatureHex,
          signedAt: e.signedAt,
        };
      });

      const proof: PoAConsensusProof = {
        consensusType: 'PROOF_OF_AUTHORITY',
        consensusVersion: '1.0',
        proposalId: record.proposal.proposalId,
        blockHash: record.proposal.proposedBlockHash,
        chainId: record.proposal.chainId,
        blockHeight: record.proposal.blockHeight,
        policyId: record.proposal.policyId,
        policyVersion: record.proposal.policyVersion,
        requiredThreshold: policy.minThreshold,
        requiredNodeIds: policy.requiredNodeIds,
        endorsingSignatures,
        collectedAt: new Date().toISOString(),
        commitTimestamp: new Date().toISOString(),
      };

      // Attach proof to block
      record.proposal.block.consensusProof = proof;
      record.proof = proof;
      record.state = 'COMMITTED';
      record.updatedAt = new Date().toISOString();

      return { valid: true, proof, state: 'COMMITTED' };
    }

    record.state = 'ENDORSEMENT_COLLECTION';
    return { valid: true, state: 'ENDORSEMENT_COLLECTION' };
  }

  /**
   * Transition overdue proposals to EXPIRED state
   */
  checkExpirations(): void {
    const now = new Date();

    for (const record of this.proposals.values()) {
      if (
        (record.state === 'PROPOSED' || record.state === 'ENDORSEMENT_COLLECTION') &&
        now > new Date(record.proposal.expiresAt)
      ) {
        record.state = 'EXPIRED';
        record.updatedAt = now.toISOString();
      }
    }
  }

  getProposal(proposalId: string): BlockProposal | null {
    const record = this.proposals.get(proposalId);
    return record ? record.proposal : null;
  }

  getProposalRecord(proposalId: string): ProposalStateRecord | null {
    return this.proposals.get(proposalId) || null;
  }
}
