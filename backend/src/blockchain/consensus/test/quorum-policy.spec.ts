/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/quorum-policy.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock } from '../../ledger/block';
import { ConsensusPolicyRegistry } from '../policy-registry';
import { createBlockEndorsement, createBlockProposal } from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Quorum & Server Policy Engine', () => {
  let registry: InMemoryNodeRegistry;
  let policyRegistry: ConsensusPolicyRegistry;
  let genesis = createGenesisBlock('nyayavault-mainnet-1');

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    policyRegistry = new ConsensusPolicyRegistry();
    genesis = createGenesisBlock('nyayavault-mainnet-1');
  });

  it('remains uncommitted when below threshold for STANDARD_ANCHOR (2 signers required)', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      policyRegistry,
      chainId: 'nyayavault-mainnet-1',
    });

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR', // minThreshold = 2, required = ['POLICE_NODE']
      chainId: 'nyayavault-mainnet-1',
    });

    manager.receiveProposal(proposal);

    // Only 1 endorsement (POLICE_NODE) added
    const policeEndorsement = createBlockEndorsement({
      endorserNode: policeNode,
      proposal,
    });

    const res = manager.addEndorsement(policeEndorsement);

    expect(res.valid).toBe(true);
    expect(res.state).toBe('ENDORSEMENT_COLLECTION');
    expect(manager.getProposalRecord(proposal.proposalId)?.state).toBe('ENDORSEMENT_COLLECTION');
  });

  it('transitions to COMMITTED when exact threshold is reached for STANDARD_ANCHOR (2-of-4)', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      policyRegistry,
      chainId: 'nyayavault-mainnet-1',
    });

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    manager.receiveProposal(proposal);

    // Endorsement 1: POLICE_NODE
    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    manager.addEndorsement(e1);

    // Endorsement 2: PROSECUTION_NODE (reaches threshold 2)
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });
    const res2 = manager.addEndorsement(e2);

    expect(res2.valid).toBe(true);
    expect(res2.state).toBe('COMMITTED');
    expect(res2.proof).toBeDefined();
    expect(res2.proof?.endorsingSignatures.length).toBe(2);
  });

  it('enforces SEALED_EVIDENCE policy requiring POLICE_NODE, PROSECUTION_NODE, and COURT_NODE', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const prosNode = registry.getNode('PROSECUTION_NODE')!;
    const adminNode = registry.getNode('ADMIN_NODE')!;
    const courtNode = registry.getNode('COURT_NODE')!;

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      policyRegistry,
      chainId: 'nyayavault-mainnet-1',
    });

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'SEALED_EVIDENCE', // minThreshold = 3, required = ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE']
      chainId: 'nyayavault-mainnet-1',
    });

    manager.receiveProposal(proposal);

    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });
    const eAdmin = createBlockEndorsement({ endorserNode: adminNode, proposal });

    manager.addEndorsement(e1);
    manager.addEndorsement(e2);

    // 3 signers (Police, Pros, Admin) reach count 3, BUT missing required COURT_NODE!
    const resAdmin = manager.addEndorsement(eAdmin);
    expect(resAdmin.state).toBe('ENDORSEMENT_COLLECTION'); // Fails required node check

    // Add required COURT_NODE endorsement
    const eCourt = createBlockEndorsement({ endorserNode: courtNode, proposal });
    const resCourt = manager.addEndorsement(eCourt);

    expect(resCourt.state).toBe('COMMITTED');
    expect(resCourt.proof).toBeDefined();
  });
});
