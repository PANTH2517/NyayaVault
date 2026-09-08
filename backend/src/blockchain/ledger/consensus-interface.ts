/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/consensus-interface.ts
 *
 * Consensus Abstraction & Proof-of-Authority (PoA) Endorsement Interface
 */

import { LedgerBlock, ConsensusProof, VerificationResult, NodeType } from './types';

export interface IConsensusEngine {
  /**
   * Validate consensus proof and endorsements attached to a block
   */
  validateConsensusProof(block: LedgerBlock, proof?: ConsensusProof): VerificationResult;

  /**
   * Check if a node ID is an authorized signer in the network topology
   */
  isAuthorizedSigner(nodeId: string): boolean;

  /**
   * Determine required endorsement threshold for a specific transaction type
   */
  getRequiredThreshold(txType?: string): number;

  /**
   * Verify if a set of endorsing node IDs satisfies quorum requirements
   */
  verifyEndorsements(endorsingNodes: NodeType[], txType?: string): VerificationResult;
}

/**
 * Basic PoA Consensus Evaluator (Default Interface Implementation)
 */
export class DefaultPoAConsensusEngine implements IConsensusEngine {
  private readonly authorizedNodes: Set<string> = new Set([
    'POLICE_NODE',
    'PROSECUTION_NODE',
    'COURT_NODE',
    'ADMIN_NODE',
  ]);

  isAuthorizedSigner(nodeId: string): boolean {
    return this.authorizedNodes.has(nodeId);
  }

  getRequiredThreshold(txType?: string): number {
    if (txType === 'CHAIN_OF_CUSTODY_CHANGE' || txType === 'SECURITY_INCIDENT_ANCHOR') {
      return 3; // Higher security threshold (3-of-4)
    }
    return 2; // Default endorsement threshold (2-of-4)
  }

  verifyEndorsements(endorsingNodes: NodeType[], txType?: string): VerificationResult {
    const validNodes = endorsingNodes.filter((node) => this.isAuthorizedSigner(node));
    const uniqueValidNodes = Array.from(new Set(validNodes));
    const required = this.getRequiredThreshold(txType);

    if (uniqueValidNodes.length < required) {
      return {
        valid: false,
        code: 'INSUFFICIENT_ENDORSEMENTS',
        reason: `Endorsement threshold not met: received ${uniqueValidNodes.length} valid signatures, required ${required}`,
      };
    }

    return { valid: true };
  }

  validateConsensusProof(block: LedgerBlock, proof?: ConsensusProof): VerificationResult {
    // Genesis block bypasses multi-sig proof
    if (block.header.height === '0') {
      return { valid: true };
    }

    if (!proof) {
      return {
        valid: false,
        code: 'MISSING_CONSENSUS_PROOF',
        reason: `Block ${block.header.height} is missing required ConsensusProof`,
      };
    }

    const endorsingNodes = proof.endorsingSignatures.map((s) => s.nodeId as NodeType);
    return this.verifyEndorsements(endorsingNodes);
  }
}
