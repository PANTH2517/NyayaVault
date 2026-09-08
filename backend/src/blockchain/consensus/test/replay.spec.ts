/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/replay.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import {
  createBlockEndorsement,
  createBlockProposal,
  verifyBlockEndorsement,
} from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Replay Protection Engine', () => {
  let registry: InMemoryNodeRegistry;
  let genesis = createGenesisBlock('nyayavault-mainnet-1');

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    genesis = createGenesisBlock('nyayavault-mainnet-1');
  });

  function createTestBlock() {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-REPLAY-101' },
    });

    const tx = signTransaction(unsignedTx, policeSigner);
    return forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });
  }

  it('rejects duplicate proposal creation for the same block hash', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const res1 = manager.createProposal(block1, 'STANDARD_ANCHOR');
    expect(res1.valid).toBe(true);

    const res2 = manager.createProposal(block1, 'STANDARD_ANCHOR');
    expect(res2.valid).toBe(false);
    expect(res2.code).toBe('DUPLICATE_PROPOSAL_BLOCK_HASH');
  });

  it('rejects adding duplicate endorsement from the same node', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const propRes = manager.createProposal(block1, 'STANDARD_ANCHOR');
    const proposal = propRes.proposal!;

    const e1 = createBlockEndorsement({ endorserNode: prosNode, proposal });

    const add1 = manager.addEndorsement(e1);
    expect(add1.valid).toBe(true);

    const add2 = manager.addEndorsement(e1);
    expect(add2.valid).toBe(false);
    expect(add2.code).toBe('DUPLICATE_ENDORSER');
  });

  it('rejects reusing endorsement on a different proposal ID', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;
    const block1 = createTestBlock();

    const proposal1 = createBlockProposal({
      proposerNode: policeNode,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      proposalTimestamp: '2026-09-06T10:00:00.000Z',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosNode,
      proposal: proposal1,
    });

    const proposal2 = createBlockProposal({
      proposerNode: policeNode,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      proposalTimestamp: '2026-09-06T11:00:00.000Z',
    });

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    manager.receiveProposal(proposal2);

    // Direct endorsement verification against mismatched proposal returns PROPOSAL_ID_MISMATCH
    const valRes = verifyBlockEndorsement(endorsement, proposal2, registry, 'nyayavault-mainnet-1');
    expect(valRes.valid).toBe(false);
    expect(valRes.code).toBe('PROPOSAL_ID_MISMATCH');

    // Submitting un-indexed proposal endorsement returns UNKNOWN_PROPOSAL
    const addRes = manager.addEndorsement(endorsement);
    expect(addRes.valid).toBe(false);
    expect(addRes.code).toBe('UNKNOWN_PROPOSAL');
  });

  it('rejects adding endorsement to an expired proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const propRes = manager.createProposal(block1, 'STANDARD_ANCHOR', -5000); // Expired 5 seconds ago
    const proposal = propRes.proposal!;

    const endorsement = createBlockEndorsement({ endorserNode: prosNode, proposal });

    const addRes = manager.addEndorsement(endorsement);
    expect(addRes.valid).toBe(false);
    expect(['INVALID_PROPOSAL_STATE', 'EXPIRED_PROPOSAL']).toContain(addRes.code);
  });
});
