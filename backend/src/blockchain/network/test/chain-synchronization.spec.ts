/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/chain-synchronization.spec.ts
 *
 * Verification of Multi-Block Peer Synchronization & Strict Validation Rules
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



describe('Peer Ledger Synchronization & Validation Protocols', () => {
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

  it('synchronizes multiple missing blocks from height 0 to height N', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const activeKey = policeIdentity.keys[0];
    const privKey = policeIdentity.privateKeysByVersion.get(1)!;

    const ledgerSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: activeKey.publicKeyPem,
      privateKeyPem: privKey,
    };

    let prevBlock = await policeNode.ledgerEngine.getLatestBlock();

    // Generate 3 blocks on POLICE_NODE
    for (let i = 1; i <= 3; i++) {
      const unsignedTx = createLedgerTransaction({
        chainId: 'nyayavault-mainnet-1',
        txType: 'EVIDENCE_ANCHOR',
        originatingNode: 'POLICE_NODE',
        nonce: i,
        payload: { sequence: i },
      });

      const tx = signTransaction(unsignedTx, ledgerSigner);

      const block = attachDummyConsensusProof(
        forgeBlock({
          previousBlock: prevBlock!,
          transactions: [tx],
          proposerNode: 'POLICE_NODE',
        }),
      );

      const appendRes = await policeNode.ledgerEngine.appendBlock(block);
      expect(appendRes.valid).toBe(true);
      prevBlock = block;
    }

    expect(await policeNode.ledgerEngine.getHeight()).toBe(3n);
    expect(await prosecutionNode.ledgerEngine.getHeight()).toBe(0n);

    // Prosecution node connects and syncs from Police node
    const syncRes = await prosecutionNode.connectAndSyncPeer('POLICE_NODE');

    expect(syncRes.success).toBe(true);
    expect(syncRes.blocksSynced).toBe(3);
    expect(await prosecutionNode.ledgerEngine.getHeight()).toBe(3n);

    // Verify all 3 blocks on Prosecution node match Police node hashes
    for (let h = 1n; h <= 3n; h++) {
      const polB = await policeNode.ledgerEngine.getBlockByHeight(h);
      const prosB = await prosecutionNode.ledgerEngine.getBlockByHeight(h);
      expect(prosB).toBeDefined();
      expect(prosB?.blockHash).toBe(polB?.blockHash);
    }
  });

  it('rejects synchronization if remote peer serves a corrupted/tampered block', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const activeKey = policeIdentity.keys[0];
    const privKey = policeIdentity.privateKeysByVersion.get(1)!;

    const ledgerSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: activeKey.publicKeyPem,
      privateKeyPem: privKey,
    };

    const prevBlock = await policeNode.ledgerEngine.getLatestBlock();

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: {},
    });

    const tx = signTransaction(unsignedTx, ledgerSigner);

    const block1 = attachDummyConsensusProof(
      forgeBlock({
        previousBlock: prevBlock!,
        transactions: [tx],
        proposerNode: 'POLICE_NODE',
      }),
    );

    await policeNode.ledgerEngine.appendBlock(block1);

    // Manually tamper block 1 inside policeStore to simulate malicious peer serving bad data
    const policeBlock1 = await policeNode.ledgerEngine.getBlockByHeight(1n);
    expect(policeBlock1).toBeDefined();
    (policeBlock1 as any).blockHash = 'f'.repeat(64); // Corrupt block hash

    // Prosecution node attempts sync
    const syncRes = await prosecutionNode.connectAndSyncPeer('POLICE_NODE');

    expect(syncRes.success).toBe(false);
    expect(syncRes.error).toBeDefined();
    // Local height of Prosecution node remains unchanged at 0
    expect(await prosecutionNode.ledgerEngine.getHeight()).toBe(0n);
  });
});
