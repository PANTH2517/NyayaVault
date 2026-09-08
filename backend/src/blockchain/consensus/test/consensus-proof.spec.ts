/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/consensus-proof.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createGenesisBlock, forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { ConsensusPolicyRegistry } from '../policy-registry';
import { PoAConsensusEngine } from '../poa-consensus-engine';
import { createBlockEndorsement, createBlockProposal } from '../endorsement-signer';
import { ProposalManager } from '../proposal-manager';

describe('Consensus Proof Validation & Cryptographic Enforcement', () => {
  let registry: InMemoryNodeRegistry;
  let consensusEngine: PoAConsensusEngine;
  let genesis = createGenesisBlock('nyayavault-mainnet-1');

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    consensusEngine = new PoAConsensusEngine(registry);
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
      payload: { caseId: 'CASE-PROOF-TEST' },
    });

    const tx = signTransaction(unsignedTx, policeSigner);
    return forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });
  }

  it('validates a complete strongly typed PoAConsensusProof', () => {
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
    });

    manager.receiveProposal(proposal);

    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });

    manager.addEndorsement(e1);
    const commitRes = manager.addEndorsement(e2);

    expect(commitRes.state).toBe('COMMITTED');
    expect(commitRes.proof).toBeDefined();

    // Verify proof through PoAConsensusEngine
    const valRes = consensusEngine.validateConsensusProof(proposal.block, commitRes.proof);
    expect(valRes.valid).toBe(true);
  });

  it('rejects consensus proof with forged signature', () => {
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
    });

    manager.receiveProposal(proposal);

    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });

    manager.addEndorsement(e1);
    const commitRes = manager.addEndorsement(e2);
    const proof = commitRes.proof!;

    // Corrupt one signature in proof
    proof.endorsingSignatures[1].signatureHex = '00'.repeat(64);

    const valRes = consensusEngine.validateConsensusProof(proposal.block, proof);
    expect(valRes.valid).toBe(false);
    expect(valRes.code).toBe('INVALID_ENDORSEMENT_SIGNATURE');
  });

  it('rejects consensus proof if block hash does not match block header hash', () => {
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
    });

    manager.receiveProposal(proposal);

    const e1 = createBlockEndorsement({ endorserNode: policeNode, proposal });
    const e2 = createBlockEndorsement({ endorserNode: prosNode, proposal });

    manager.addEndorsement(e1);
    const commitRes = manager.addEndorsement(e2);
    const proof = commitRes.proof!;

    // Tamper block hash in proof
    proof.blockHash = 'f'.repeat(64);

    const valRes = consensusEngine.validateConsensusProof(proposal.block, proof);
    expect(valRes.valid).toBe(false);
    expect(valRes.code).toBe('CONSENSUS_PROOF_HASH_MISMATCH');
  });
});
