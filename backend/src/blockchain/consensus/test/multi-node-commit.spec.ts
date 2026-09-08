/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/multi-node-commit.spec.ts
 *
 * Multi-Node Peer Network Consensus & Multi-Signature Block Commit Integration Tests
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { InMemoryNodeTransportDispatcher } from '../../network/in-memory-transport';
import { NodeRuntime } from '../../network/node-runtime';

describe('Multi-Node Consensus Network & Block Commit Protocol', () => {
  let registry: InMemoryNodeRegistry;
  let transport: InMemoryNodeTransportDispatcher;

  let policeNode: NodeRuntime;
  let prosecutionNode: NodeRuntime;
  let courtNode: NodeRuntime;
  let adminNode: NodeRuntime;

  beforeEach(async () => {
    registry = new InMemoryNodeRegistry();
    transport = new InMemoryNodeTransportDispatcher();

    policeNode = new NodeRuntime({
      nodeIdentity: registry.getNode('POLICE_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    prosecutionNode = new NodeRuntime({
      nodeIdentity: registry.getNode('PROSECUTION_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    courtNode = new NodeRuntime({
      nodeIdentity: registry.getNode('COURT_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    adminNode = new NodeRuntime({
      nodeIdentity: registry.getNode('ADMIN_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    // Start all 4 permissioned nodes
    await policeNode.start();
    await prosecutionNode.start();
    await courtNode.start();
    await adminNode.start();
  });

  afterEach(() => {
    policeNode.stop();
    prosecutionNode.stop();
    courtNode.stop();
    adminNode.stop();
  });

  it('executes end-to-end multi-signature consensus proposal, endorsement collection, commit, and peer propagation', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const polGen = await policeNode.ledgerEngine.getLatestBlock();

    // 1. Forge a block on POLICE_NODE
    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-2026-CONSENSUS-100' },
    });

    const tx = signTransaction(unsignedTx, policeSigner);

    const block1 = forgeBlock({
      previousBlock: polGen!,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });

    // 2. POLICE_NODE proposes block and collects peer endorsements over transport
    const commitResult = await policeNode.proposeAndCommitBlock(block1, 'STANDARD_ANCHOR');

    expect(commitResult.valid).toBe(true);
    expect(commitResult.proof).toBeDefined();
    expect(commitResult.proof?.consensusType).toBe('PROOF_OF_AUTHORITY');
    expect(commitResult.proof?.endorsingSignatures.length).toBeGreaterThanOrEqual(2);

    // 3. Verify POLICE_NODE height updated to 1
    const polHeight = await policeNode.ledgerEngine.getHeight();
    expect(polHeight).toBe(1n);

    // 4. Verify peers independently received, verified, and committed the block
    const prosHeight = await prosecutionNode.ledgerEngine.getHeight();
    const courtHeight = await courtNode.ledgerEngine.getHeight();

    expect(prosHeight).toBe(1n);
    expect(courtHeight).toBe(1n);

    // 5. Verify the committed block on prosecution node has valid PoAConsensusProof attached
    const prosBlock1 = await prosecutionNode.ledgerEngine.getBlockByHeight(1n);
    expect(prosBlock1).toBeDefined();
    expect(prosBlock1?.blockHash).toBe(block1.blockHash);
    expect(prosBlock1?.consensusProof).toBeDefined();
    expect(prosBlock1?.consensusProof?.endorsingSignatures.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects proposal if expired before reaching quorum', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const polGen = await policeNode.ledgerEngine.getLatestBlock();

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { test: 'expired' },
    });

    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const tx = signTransaction(unsignedTx, policeSigner);
    const block = forgeBlock({ previousBlock: polGen!, transactions: [tx], proposerNode: 'POLICE_NODE' });

    // Propose block with negative timeout (already expired)
    const commitResult = await policeNode.proposeAndCommitBlock(block, 'STANDARD_ANCHOR', -1000);

    expect(commitResult.valid).toBe(false);
    expect(commitResult.code).toBe('QUORUM_NOT_REACHED');

    // Height remains 0
    expect(await policeNode.ledgerEngine.getHeight()).toBe(0n);
  });
});
