/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/poa-consensus-engine.ts
 *
 * Real Cryptographic Proof-of-Authority (PoA) Consensus Engine Implementation
 */

import { IConsensusEngine } from '../ledger/consensus-interface';
import { ConsensusProof, LedgerBlock, NodeType, VerificationResult } from '../ledger/types';
import { INodeRegistry } from '../identity/node-registry.interface';
import { computeBlockHash } from '../ledger/block';
import { verifyDomainPayload } from '../identity/domain-signer';
import { computeCanonicalEndorsementData, CONSENSUS_DOMAIN_NAME } from './endorsement-signer';
import { ConsensusPolicyRegistry } from './policy-registry';
import { BlockEndorsement, EndorsementSignatureRecord, PoAConsensusProof } from './types';

export class PoAConsensusEngine implements IConsensusEngine {
  constructor(
    public readonly nodeRegistry?: INodeRegistry,
    private readonly policyRegistry: ConsensusPolicyRegistry = new ConsensusPolicyRegistry(),
  ) {}

  isAuthorizedSigner(nodeId: string): boolean {
    const authorizedNodes = ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'];
    return authorizedNodes.includes(nodeId);
  }

  getRequiredThreshold(txType?: string): number {
    if (txType === 'SEALED_EVIDENCE' || txType === 'CHAIN_OF_CUSTODY_CHANGE' || txType === 'SECURITY_INCIDENT_ANCHOR') {
      return 3;
    }
    return 2;
  }

  verifyEndorsements(endorsingNodes: NodeType[], txType?: string): VerificationResult {
    const validNodes = endorsingNodes.filter((node) => this.isAuthorizedSigner(node));
    const uniqueValidNodes = Array.from(new Set(validNodes));
    const required = this.getRequiredThreshold(txType);

    if (uniqueValidNodes.length < required) {
      return {
        valid: false,
        code: 'INSUFFICIENT_ENDORSEMENTS',
        reason: `Endorsement threshold not met: received ${uniqueValidNodes.length} valid unique signers, required ${required}`,
      };
    }

    return { valid: true };
  }

  validateConsensusProof(block: LedgerBlock, proof?: ConsensusProof): VerificationResult {
    // 1. Genesis block without proof bypasses multi-sig consensus proof
    if (block.header.height === '0' && !proof) {
      return { valid: true };
    }

    if (!proof) {
      return {
        valid: false,
        code: 'MISSING_CONSENSUS_PROOF',
        reason: `Block at height ${block.header.height} is missing required ConsensusProof`,
      };
    }

    if (proof.consensusType !== 'PROOF_OF_AUTHORITY') {
      return {
        valid: false,
        code: 'INVALID_CONSENSUS_TYPE',
        reason: `Unsupported consensus type '${proof.consensusType}', expected 'PROOF_OF_AUTHORITY'`,
      };
    }

    // Cast or extract fields from extended PoAConsensusProof
    const poaProof = proof as PoAConsensusProof;
    const policyId = poaProof.policyId || 'STANDARD_ANCHOR';

    // 2. Verify block hash match if present in proof
    if (poaProof.blockHash) {
      const computedHash = computeBlockHash(block.header);
      if (poaProof.blockHash !== computedHash || poaProof.blockHash !== block.blockHash) {
        return {
          valid: false,
          code: 'CONSENSUS_PROOF_HASH_MISMATCH',
          reason: `Consensus proof blockHash '${poaProof.blockHash}' does not match actual block hash '${block.blockHash}'`,
        };
      }
    }

    // 3. Verify Signer Uniqueness (A node can contribute at most ONE signature)
    const seenNodes = new Set<string>();
    const uniqueSignatures: EndorsementSignatureRecord[] = [];

    for (const sig of proof.endorsingSignatures) {
      const nodeId = sig.nodeId as string;
      if (seenNodes.has(nodeId)) {
        // Reject duplicate signature from same node
        continue;
      }
      seenNodes.add(nodeId);
      uniqueSignatures.push(sig as EndorsementSignatureRecord);
    }

    // 4. Verify each signature cryptographically if nodeRegistry is available
    if (this.nodeRegistry) {
      for (const sig of uniqueSignatures) {
        const node = this.nodeRegistry.getNode(sig.nodeId);
        if (!node) {
          return {
            valid: false,
            code: 'UNAUTHORIZED_ENDORSER_NODE',
            reason: `Endorsing node '${sig.nodeId}' is not registered in network topology`,
          };
        }

        if (!this.nodeRegistry.isAuthorized(sig.nodeId)) {
          return {
            valid: false,
            code: 'DISABLED_ENDORSER_NODE',
            reason: `Endorsing node '${sig.nodeId}' is disabled or unauthorized in network topology`,
          };
        }

        const keyVersion = sig.keyVersion || node.currentVersion;
        let keyRecord = node.keys.find((k) => k.version === keyVersion);

        if (sig.publicKeyPem) {
          keyRecord = {
            version: keyVersion,
            publicKeyPem: sig.publicKeyPem,
            fingerprint: sig.keyFingerprint || '',
            createdAt: new Date().toISOString(),
            status: 'ACTIVE',
          };
        }

        if (!keyRecord) {
          return {
            valid: false,
            code: 'UNKNOWN_ENDORSER_KEY_VERSION',
            reason: `Key version ${keyVersion} not found for endorsing node '${sig.nodeId}'`,
          };
        }

        if (sig.keyFingerprint && sig.keyFingerprint !== keyRecord.fingerprint) {
          return {
            valid: false,
            code: 'ENDORSER_FINGERPRINT_MISMATCH',
            reason: `Key fingerprint mismatch for endorsing node '${sig.nodeId}'`,
          };
        }

        // Verify cryptographic domain signature over canonical endorsement data
        if (poaProof.proposalId) {
          const canonicalData = computeCanonicalEndorsementData({
            proposalId: poaProof.proposalId,
            chainId: poaProof.chainId || block.header.chainId,
            blockHeight: poaProof.blockHeight || block.header.height,
            previousBlockHash: block.header.previousBlockHash,
            blockHash: block.blockHash,
            nodeId: sig.nodeId,
            keyVersion,
            keyFingerprint: keyRecord.fingerprint,
            policyId,
            policyVersion: poaProof.policyVersion || '1.0',
            signedAt: sig.signedAt,
          });

          const isSigValid = verifyDomainPayload(
            keyRecord.publicKeyPem,
            CONSENSUS_DOMAIN_NAME,
            canonicalData,
            sig.signatureHex,
          );

          if (!isSigValid) {
            return {
              valid: false,
              code: 'INVALID_ENDORSEMENT_SIGNATURE',
              reason: `Cryptographic domain signature verification failed for endorsing node '${sig.nodeId}'`,
            };
          }
        }
      }
    }

    // 5. Evaluate policy quorum rules
    const mockEndorsements: BlockEndorsement[] = uniqueSignatures.map((sig) => ({
      endorsementId: `end-${sig.nodeId}-${sig.signedAt}`,
      proposalId: poaProof.proposalId || 'prop-default',
      chainId: poaProof.chainId || block.header.chainId,
      blockHeight: poaProof.blockHeight || block.header.height,
      previousBlockHash: block.header.previousBlockHash,
      blockHash: block.blockHash,
      nodeId: sig.nodeId,
      keyVersion: sig.keyVersion || 1,
      keyFingerprint: sig.keyFingerprint || '',
      policyId,
      policyVersion: poaProof.policyVersion || '1.0',
      signedAt: sig.signedAt,
      signatureHex: sig.signatureHex,
    }));

    return this.policyRegistry.evaluateQuorum(policyId, mockEndorsements);
  }
}
