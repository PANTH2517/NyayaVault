/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/divergence.spec.ts
 *
 * Verification of Chain Divergence & Split History Conflict Detection
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
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



describe('Chain Divergence & History Conflict Detection', () => {
  let registry: InMemoryNodeRegistry;
  let transport: InMemoryNodeTransportDispatcher;

  let policeNode: NodeRuntime;
  let prosecutionNode: NodeRuntime;

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

    await policeNode.start();
    await prosecutionNode.start();
  });

  afterEach(() => {
    policeNode.stop();
    prosecutionNode.stop();
  });

  it('detects divergence when two nodes are at the same height but have different block hashes', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const prosIdentity = registry.getNode('PROSECUTION_NODE')!;

    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const prosSigner: LedgerNodeIdentity = {
      nodeId: 'PROSECUTION_NODE',
      name: 'Prosecution Node',
      publicKeyPem: prosIdentity.keys[0].publicKeyPem,
      privateKeyPem: prosIdentity.privateKeysByVersion.get(1)!,
    };

    const polGen = await policeNode.ledgerEngine.getLatestBlock();
    const prosGen = await prosecutionNode.ledgerEngine.getLatestBlock();

    // Create block 1 on Police node
    const unsignedTxPolice = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { source: 'POLICE' },
    });

    const txPolice = signTransaction(unsignedTxPolice, policeSigner);

    const blockPolice = attachDummyConsensusProof(
      forgeBlock({
        previousBlock: polGen!,
        transactions: [txPolice],
        proposerNode: 'POLICE_NODE',
      }),
    );

    const appendPolRes = await policeNode.ledgerEngine.appendBlock(blockPolice);
    expect(appendPolRes.valid).toBe(true);

    // Create a conflicting block 1 on Prosecution node
    const unsignedTxPros = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'PROSECUTION_NODE',
      nonce: 1,
      payload: { source: 'PROSECUTION' },
    });

    const txPros = signTransaction(unsignedTxPros, prosSigner);

    const blockPros = attachDummyConsensusProof(
      forgeBlock({
        previousBlock: prosGen!,
        transactions: [txPros],
        proposerNode: 'PROSECUTION_NODE',
      }),
    );

    const appendProsRes = await prosecutionNode.ledgerEngine.appendBlock(blockPros);
    expect(appendProsRes.valid).toBe(true);

    // Both nodes are at height 1, but block hashes differ
    expect(await policeNode.ledgerEngine.getHeight()).toBe(1n);
    expect(await prosecutionNode.ledgerEngine.getHeight()).toBe(1n);
    expect(blockPolice.blockHash).not.toBe(blockPros.blockHash);

    // Prosecution node attempts sync with Police node
    const syncRes = await prosecutionNode.connectAndSyncPeer('POLICE_NODE');

    // Must report divergence and NOT overwrite local chain
    expect(syncRes.success).toBe(false);
    expect(syncRes.divergence).toBeDefined();
    expect(syncRes.divergence?.diverged).toBe(true);
    expect(syncRes.divergence?.code).toBe('SAME_HEIGHT_DIFFERENT_HASH');

    // Local chain of Prosecution node remains untouched at blockPros hash
    const prosCurrentBlock = await prosecutionNode.ledgerEngine.getLatestBlock();
    expect(prosCurrentBlock?.blockHash).toBe(blockPros.blockHash);
  });

  it('detects divergence when nodes belong to different genesis block histories', async () => {
    // Create a third node on a custom chain ID
    const courtCustomNode = new NodeRuntime({
      nodeIdentity: registry.getNode('COURT_NODE')!,
      nodeRegistry: registry,
      transport,
      chainId: 'nyayavault-testnet-custom',
    });

    await courtCustomNode.start();

    // Sync attempt between different chain IDs
    const syncRes = await courtCustomNode.connectAndSyncPeer('POLICE_NODE');

    expect(syncRes.success).toBe(false);
    expect(syncRes.error).toBeDefined();

    courtCustomNode.stop();
  });
});
