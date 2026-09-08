/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/expiration.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { createBlockEndorsement, createBlockProposal } from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Proposal Expiration Lifecycle Engine', () => {
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
      payload: { caseId: 'CASE-EXPIRATION-101' },
    });

    const tx = signTransaction(unsignedTx, policeSigner);
    return forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });
  }

  it('rejects receiving an already expired block proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const expiredProposal = createBlockProposal({
      proposerNode: policeNode,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      timeoutMs: -10000,
    });

    const recRes = manager.receiveProposal(expiredProposal);
    expect(recRes.valid).toBe(false);
    expect(recRes.code).toBe('EXPIRED_PROPOSAL');
  });

  it('transitions active proposals to EXPIRED state when checkExpirations is invoked after timeout', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const propRes = manager.createProposal(block1, 'STANDARD_ANCHOR', 50); // Expires in 50ms
    expect(propRes.valid).toBe(true);

    const proposal = propRes.proposal!;

    // Wait short delay to cross 50ms expiration boundary
    const start = Date.now();
    while (Date.now() - start < 70) {}

    manager.checkExpirations();

    const rec = manager.getProposalRecord(proposal.proposalId);
    expect(rec?.state).toBe('EXPIRED');
  });

  it('prevents expired proposal from committing even if threshold signatures arrive late', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;
    const block1 = createTestBlock();

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      timeoutMs: -1000,
    });

    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });

    const add1 = manager.addEndorsement(e1);
    expect(add1.valid).toBe(false);

    const add2 = manager.addEndorsement(e2);
    expect(add2.valid).toBe(false);
  });
});
