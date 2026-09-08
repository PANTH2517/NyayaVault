/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/proposal.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { ConsensusPolicyRegistry } from '../policy-registry';
import { createBlockProposal, verifyBlockProposal } from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Block Proposal Engine', () => {
  let registry: InMemoryNodeRegistry;
  let policyRegistry: ConsensusPolicyRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    policyRegistry = new ConsensusPolicyRegistry();
  });

  it('allows authorized proposer to create a valid block proposal', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const genesis = createGenesisBlock('nyayavault-mainnet-1');

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-2026-PROP' },
    });

    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeNode.keys[0].publicKeyPem,
      privateKeyPem: policeNode.privateKeysByVersion.get(1)!,
    };

    const tx = signTransaction(unsignedTx, policeSigner);

    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const result = verifyBlockProposal(proposal, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(true);
    expect(proposal.proposalId).toBeDefined();
    expect(proposal.proposerNodeId).toBe('POLICE_NODE');
  });

  it('rejects proposal created by an unauthorized proposer for a policy', () => {
    const courtNode = registry.getNode('COURT_NODE')!;

    // COURT_NODE is not an authorized proposer for GOVERNANCE_CHECKPOINT policy
    const permVal = policyRegistry.validateProposalPermission('COURT_NODE', 'GOVERNANCE_CHECKPOINT');
    expect(permVal.valid).toBe(false);
    expect(permVal.code).toBe('UNAUTHORIZED_PROPOSER');
  });

  it('generates a deterministic proposal ID', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const fixedTime = '2026-09-06T12:00:00.000Z';

    const proposal1 = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      timeoutMs: 60000,
      proposalTimestamp: fixedTime,
    });

    const proposal2 = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      timeoutMs: 60000,
      proposalTimestamp: fixedTime,
    });

    // Same block and parameters produce identical deterministic proposal IDs
    expect(proposal1.proposalId).toBe(proposal2.proposalId);
  });

  it('rejects proposal if block content is modified after creation', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const genesis = createGenesisBlock('nyayavault-mainnet-1');

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    // Tamper proposed block header height
    proposal.block.header.height = '999';

    const result = verifyBlockProposal(proposal, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('PROPOSED_HASH_MISMATCH');
  });
});
