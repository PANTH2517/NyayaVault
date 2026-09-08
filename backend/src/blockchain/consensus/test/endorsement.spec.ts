/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/endorsement.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock } from '../../ledger/block';
import {
  createBlockEndorsement,
  createBlockProposal,
  verifyBlockEndorsement,
} from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Block Endorsement Verification', () => {
  let registry: InMemoryNodeRegistry;
  let genesis = createGenesisBlock('nyayavault-mainnet-1');

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    genesis = createGenesisBlock('nyayavault-mainnet-1');
  });

  it('creates and verifies valid block endorsement binding to exact proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosNode,
      proposal,
    });

    const result = verifyBlockEndorsement(endorsement, proposal, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(true);
  });

  it('rejects endorsement if proposal ID does not match target proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const proposal1 = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosNode,
      proposal: proposal1,
    });

    // Attempt to verify endorsement against a different proposal
    const proposal2 = { ...proposal1, proposalId: 'different-proposal-id' };
    const result = verifyBlockEndorsement(endorsement, proposal2, registry, 'nyayavault-mainnet-1');

    expect(result.valid).toBe(false);
    expect(result.code).toBe('PROPOSAL_ID_MISMATCH');
  });

  it('rejects endorsement if block hash does not match target proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosNode,
      proposal,
    });

    // Tamper blockHash in endorsement
    endorsement.blockHash = '0'.repeat(64);

    const result = verifyBlockEndorsement(endorsement, proposal, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BLOCK_HASH_MISMATCH');
  });

  it('rejects endorsement created with a revoked key version', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosNode,
      proposal,
    });

    // Revoke key for prosecution node
    registry.revokeNodeKey('PROSECUTION_NODE', 1);

    const result = verifyBlockEndorsement(endorsement, proposal, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('REVOKED_ENDORSER_KEY');
  });

  it('rejects duplicate endorsement from the same node ID in ProposalManager', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const propRes = manager.createProposal(genesis, 'STANDARD_ANCHOR');
    const proposal = propRes.proposal!;

    const endorsement1 = createBlockEndorsement({
      endorserNode: prosNode,
      proposal,
    });

    const endorsement2 = createBlockEndorsement({
      endorserNode: prosNode,
      proposal,
    });

    // First endorsement from PROSECUTION_NODE succeeds
    const res1 = manager.addEndorsement(endorsement1);
    expect(res1.valid).toBe(true);

    // Duplicate endorsement from PROSECUTION_NODE is rejected
    const res2 = manager.addEndorsement(endorsement2);
    expect(res2.valid).toBe(false);
    expect(res2.code).toBe('DUPLICATE_ENDORSER');
  });
});
