/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/fork.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { createBlockProposal } from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Fork & Divergence Conflict Engine', () => {
  let registry: InMemoryNodeRegistry;
  let genesis = createGenesisBlock('nyayavault-mainnet-1');

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    genesis = createGenesisBlock('nyayavault-mainnet-1');
  });

  function createTestBlock(caseId: string) {
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
      payload: { caseId },
    });

    const tx = signTransaction(unsignedTx, policeSigner);
    return forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });
  }

  it('detects two conflicting proposals for the same block height and transitions to DIVERGED', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const blockA = createTestBlock('CASE-FORK-A');
    const blockB = createTestBlock('CASE-FORK-B');

    expect(blockA.blockHash).not.toBe(blockB.blockHash);
    expect(blockA.header.height).toBe(blockB.header.height);

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    const propA = createBlockProposal({
      proposerNode: policeNode,
      block: blockA,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const propB = createBlockProposal({
      proposerNode: policeNode,
      block: blockB,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    // Accept proposal A
    const resA = manager.receiveProposal(propA);
    expect(resA.valid).toBe(true);

    // Proposal B arrives for the same height with a different block hash
    const resB = manager.receiveProposal(propB);
    expect(resB.valid).toBe(false);
    expect(resB.code).toBe('CONFLICTING_PROPOSALS_SAME_HEIGHT');

    // Confirm proposal B is recorded in DIVERGED state
    const recB = manager.getProposalRecord(propB.proposalId);
    expect(recB?.state).toBe('DIVERGED');
  });

  it('rejects proposal with conflicting previous block hash', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const block = createTestBlock('CASE-FORK-PREV');

    // Tamper previous block hash in header
    block.header.previousBlockHash = 'e'.repeat(64);

    const manager = new ProposalManager({
      localNode: policeNode,
      nodeRegistry: registry,
      chainId: 'nyayavault-mainnet-1',
    });

    // verifyBlockProposal fails because computing header hash produces a mismatch with block.blockHash
    const propRes = manager.createProposal(block, 'STANDARD_ANCHOR');
    expect(propRes.valid).toBe(true);

    const verifyRes = manager.receiveProposal(propRes.proposal!);
    expect(verifyRes.valid).toBe(false);
    expect(verifyRes.code).toBe('PROPOSED_HASH_MISMATCH');
  });
});
