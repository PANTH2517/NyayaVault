/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/node-isolation.spec.ts
 *
 * Verification of Multi-Node Memory Isolation & Independent Ledger Stores
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { InMemoryLedgerStore } from '../../ledger/in-memory-ledger-store';
import { forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { InMemoryNodeTransportDispatcher } from '../in-memory-transport';
import { NodeRuntime } from '../node-runtime';
import { LedgerBlock, LedgerNodeIdentity } from '../../ledger/types';

function attachDummyConsensusProof(block: LedgerBlock): LedgerBlock {
  block.consensusProof = {
    consensusType: 'PROOF_OF_AUTHORITY',
    requiredThreshold: 2,
    endorsingSignatures: [
      { nodeId: 'POLICE_NODE', publicKeyPem: 'pem1', signatureHex: 'sig1', signedAt: new Date().toISOString() },
      { nodeId: 'PROSECUTION_NODE', publicKeyPem: 'pem2', signatureHex: 'sig2', signedAt: new Date().toISOString() },
    ],
  };
  return block;
}



describe('Multi-Node Isolation & Independent Ledger Memory Stores', () => {
  let registry: InMemoryNodeRegistry;
  let transport: InMemoryNodeTransportDispatcher;

  let policeStore: InMemoryLedgerStore;
  let prosecutionStore: InMemoryLedgerStore;
  let courtStore: InMemoryLedgerStore;

  let policeNode: NodeRuntime;
  let prosecutionNode: NodeRuntime;
  let courtNode: NodeRuntime;

  beforeEach(async () => {
    registry = new InMemoryNodeRegistry();
    transport = new InMemoryNodeTransportDispatcher();

    // 1. Instantiate THREE completely separate, unshared ledger stores
    policeStore = new InMemoryLedgerStore();
    prosecutionStore = new InMemoryLedgerStore();
    courtStore = new InMemoryLedgerStore();

    // 2. Create three independent NodeRuntime instances
    policeNode = new NodeRuntime({
      nodeIdentity: registry.getNode('POLICE_NODE')!,
      nodeRegistry: registry,
      ledgerStore: policeStore,
      transport,
    });

    prosecutionNode = new NodeRuntime({
      nodeIdentity: registry.getNode('PROSECUTION_NODE')!,
      nodeRegistry: registry,
      ledgerStore: prosecutionStore,
      transport,
    });

    courtNode = new NodeRuntime({
      nodeIdentity: registry.getNode('COURT_NODE')!,
      nodeRegistry: registry,
      ledgerStore: courtStore,
      transport,
    });

    // Start all 3 nodes
    await policeNode.start();
    await prosecutionNode.start();
    await courtNode.start();
  });

  afterEach(() => {
    policeNode.stop();
    prosecutionNode.stop();
    courtNode.stop();
  });

  it('guarantees each node has its own isolated ledger store with separate memory references', async () => {
    const policeHeight = await policeStore.getHeight();
    const prosHeight = await prosecutionStore.getHeight();
    const courtHeight = await courtStore.getHeight();

    // All initialized with genesis block at height 0
    expect(policeHeight).toBe(0n);
    expect(prosHeight).toBe(0n);
    expect(courtHeight).toBe(0n);

    // Verify genesis block objects are distinct memory instances
    const policeGen = await policeStore.getBlockByHeight(0n);
    const prosGen = await prosecutionStore.getBlockByHeight(0n);

    expect(policeGen).toBeDefined();
    expect(prosGen).toBeDefined();
    expect(policeGen).not.toBe(prosGen); // Strictly different object references
  });

  it('mutating police local chain does NOT mutate prosecution or court nodes', async () => {
    const policeGen = await policeNode.ledgerEngine.getLatestBlock();
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const activeKey = policeIdentity.keys[0];
    const privKey = policeIdentity.privateKeysByVersion.get(1)!;

    const ledgerSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: activeKey.publicKeyPem,
      privateKeyPem: privKey,
    };

    // Create a new transaction signed by POLICE_NODE
    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { title: 'Crime Scene Evidence' },
    });

    const tx = signTransaction(unsignedTx, ledgerSigner);

    // Forge and append block 1 on POLICE_NODE only
    const block1 = attachDummyConsensusProof(
      forgeBlock({
        previousBlock: policeGen!,
        transactions: [tx],
        proposerNode: 'POLICE_NODE',
      }),
    );

    const appendRes = await policeNode.ledgerEngine.appendBlock(block1);
    expect(appendRes.valid).toBe(true);

    // Police node height is now 1
    const newPoliceHeight = await policeNode.ledgerEngine.getHeight();
    expect(newPoliceHeight).toBe(1n);

    // Prosecution and Court node heights MUST REMAIN AT 0
    const prosHeight = await prosecutionNode.ledgerEngine.getHeight();
    const courtHeight = await courtNode.ledgerEngine.getHeight();

    expect(prosHeight).toBe(0n);
    expect(courtHeight).toBe(0n);
  });

  it('synchronizes data exclusively through network protocol without shared state', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const activeKey = policeIdentity.keys[0];
    const privKey = policeIdentity.privateKeysByVersion.get(1)!;

    const ledgerSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: activeKey.publicKeyPem,
      privateKeyPem: privKey,
    };

    const policeGen = await policeNode.ledgerEngine.getLatestBlock();

    // Add block 1 to Police node
    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-2026-99' },
    });

    const tx = signTransaction(unsignedTx, ledgerSigner);

    const block1 = attachDummyConsensusProof(
      forgeBlock({
        previousBlock: policeGen!,
        transactions: [tx],
        proposerNode: 'POLICE_NODE',
      }),
    );

    await policeNode.ledgerEngine.appendBlock(block1);

    // Before sync: Court node is at height 0
    expect(await courtNode.ledgerEngine.getHeight()).toBe(0n);

    // Court node connects and syncs from Police node over P2P transport
    const syncRes = await courtNode.connectAndSyncPeer('POLICE_NODE');

    expect(syncRes.success).toBe(true);
    expect(syncRes.blocksSynced).toBe(1);

    // After sync: Court node is at height 1 with identical valid block data
    const courtHeight = await courtNode.ledgerEngine.getHeight();
    expect(courtHeight).toBe(1n);

    const courtSyncedBlock = await courtNode.ledgerEngine.getBlockByHeight(1n);
    expect(courtSyncedBlock).toBeDefined();
    expect(courtSyncedBlock?.blockHash).toBe(block1.blockHash);

    // Verify Court node block object is a cloned instance, not the same memory reference as Police block
    const policeBlock1 = await policeNode.ledgerEngine.getBlockByHeight(1n);
    expect(courtSyncedBlock).not.toBe(policeBlock1);
  });
});
