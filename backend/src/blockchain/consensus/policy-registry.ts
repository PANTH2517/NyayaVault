/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/policy-registry.ts
 *
 * Server-Controlled Versioned Consensus Policy Engine
 */

import { NodeType, VerificationResult } from '../ledger/types';
import { BlockEndorsement, ConsensusPolicy } from './types';

export class ConsensusPolicyRegistry {
  private policies: Map<string, ConsensusPolicy> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies() {
    const defaultPolicies: ConsensusPolicy[] = [
      {
        policyId: 'STANDARD_ANCHOR',
        policyVersion: '1.0',
        name: 'Standard Evidence & Chain Anchor Policy',
        minThreshold: 2,
        requiredNodeIds: ['POLICE_NODE'],
        eligibleNodes: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'],
        proposerNodes: ['POLICE_NODE', 'ADMIN_NODE'],
        timeoutMs: 60000,
      },
      {
        policyId: 'SEALED_EVIDENCE',
        policyVersion: '1.0',
        name: 'Judicial Sealing & High-Security Evidence Policy',
        minThreshold: 3,
        requiredNodeIds: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE'],
        eligibleNodes: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'],
        proposerNodes: ['POLICE_NODE', 'PROSECUTION_NODE', 'ADMIN_NODE'],
        timeoutMs: 60000,
      },
      {
        policyId: 'GOVERNANCE_CHECKPOINT',
        policyVersion: '1.0',
        name: 'Network Governance & Topology Checkpoint Policy',
        minThreshold: 3,
        requiredNodeIds: ['ADMIN_NODE'],
        eligibleNodes: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'],
        proposerNodes: ['ADMIN_NODE'],
        timeoutMs: 60000,
      },
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.policyId, policy);
    }
  }

  getPolicy(policyId: string): ConsensusPolicy | null {
    return this.policies.get(policyId) || null;
  }

  registerPolicy(policy: ConsensusPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  validateProposalPermission(proposerNodeId: NodeType, policyId: string): VerificationResult {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return {
        valid: false,
        code: 'UNKNOWN_CONSENSUS_POLICY',
        reason: `Consensus policy '${policyId}' is not registered`,
      };
    }

    if (!policy.proposerNodes.includes(proposerNodeId)) {
      return {
        valid: false,
        code: 'UNAUTHORIZED_PROPOSER',
        reason: `Node '${proposerNodeId}' is not authorized to propose blocks under policy '${policyId}'`,
      };
    }

    return { valid: true };
  }

  validateEndorsementPermission(endorserNodeId: NodeType, policyId: string): VerificationResult {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return {
        valid: false,
        code: 'UNKNOWN_CONSENSUS_POLICY',
        reason: `Consensus policy '${policyId}' is not registered`,
      };
    }

    if (!policy.eligibleNodes.includes(endorserNodeId)) {
      return {
        valid: false,
        code: 'INELIGIBLE_ENDORSER',
        reason: `Node '${endorserNodeId}' is not eligible to endorse proposals under policy '${policyId}'`,
      };
    }

    return { valid: true };
  }

  evaluateQuorum(policyId: string, endorsements: BlockEndorsement[]): VerificationResult {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return {
        valid: false,
        code: 'UNKNOWN_CONSENSUS_POLICY',
        reason: `Consensus policy '${policyId}' is not registered`,
      };
    }

    // Filter valid eligible unique node IDs (signer uniqueness enforcement)
    const validEndorsementsByNode = new Map<NodeType, BlockEndorsement>();

    for (const endorsement of endorsements) {
      if (policy.eligibleNodes.includes(endorsement.nodeId)) {
        // Signer uniqueness: A node can contribute at most ONE endorsement
        if (!validEndorsementsByNode.has(endorsement.nodeId)) {
          validEndorsementsByNode.set(endorsement.nodeId, endorsement);
        }
      }
    }

    const uniqueNodes = Array.from(validEndorsementsByNode.keys());

    // 1. Check minimum threshold
    if (uniqueNodes.length < policy.minThreshold) {
      return {
        valid: false,
        code: 'INSUFFICIENT_ENDORSEMENTS',
        reason: `Consensus threshold not met for policy '${policyId}': received ${uniqueNodes.length} unique valid signers, required minimum ${policy.minThreshold}`,
        details: { receivedCount: uniqueNodes.length, requiredThreshold: policy.minThreshold },
      };
    }

    // 2. Check required node IDs
    for (const reqNodeId of policy.requiredNodeIds) {
      if (!validEndorsementsByNode.has(reqNodeId)) {
        return {
          valid: false,
          code: 'MISSING_REQUIRED_ENDORSER',
          reason: `Required organization node '${reqNodeId}' has not endorsed proposal under policy '${policyId}'`,
          details: { missingRequiredNode: reqNodeId },
        };
      }
    }

    return { valid: true };
  }
}
