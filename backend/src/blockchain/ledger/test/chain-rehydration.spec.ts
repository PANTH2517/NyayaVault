/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER TESTS
 * File: backend/src/blockchain/ledger/test/chain-rehydration.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { forgeBlock } from '../block';
import { createLedgerTransaction, signTransaction } from '../transaction';
import { LedgerNodeIdentity } from '../types';
import { PrismaLedgerStore } from '../prisma-ledger-store';
import { createMockPrismaClient } from './mock-prisma-client';
import { InMemoryNodeTransportDispatcher } from '../../network/in-memory-transport';
import { NodeRuntime } from '../../network/node-runtime';
import { createBlockEndorsement, createBlockProposal } from '../../consensus/endorsement-signer';

describe('Chain Rehydration & Persistent Node Restart Engine', () => {
  let registry: InMemoryNodeRegistry;
  let transport: InMemoryNodeTransportDispatcher;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    transport = new InMemoryNodeTransportDispatcher();
  });

  it('successfully rehydrates chain from persistent store and achieves READY state on node startup', async () => {
    const mockPrisma = createMockPrismaClient();

    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const store = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const nodeRuntime = new NodeRuntime({
      nodeIdentity: policeIdentity,
      nodeRegistry: registry,
      ledgerStore: store,
      transport,
      chainId: 'nyayavault-mainnet-1',
    });

    expect(nodeRuntime.lifecycleState).toBe('INITIALIZING');

    await nodeRuntime.start();

    expect(nodeRuntime.lifecycleState).toBe('READY');
    const height = await nodeRuntime.ledgerEngine.getHeight();
    expect(height).toBe(0n);

    nodeRuntime.stop();
  });

  it('survives node restart: rehydrates committed chain and continues block production from correct height', async () => {
    const mockPrisma = createMockPrismaClient();

    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const prosecutionIdentity = registry.getNode('PROSECUTION_NODE')!;
    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const store1 = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const runtime1 = new NodeRuntime({
      nodeIdentity: policeIdentity,
      nodeRegistry: registry,
      ledgerStore: store1,
      transport,
      chainId: 'nyayavault-mainnet-1',
    });

    await runtime1.start();

    const gen = await runtime1.ledgerEngine.getLatestBlock();

    // 1. Commit block 1 on runtime 1
    const unsignedTx1 = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-REHYDRATE-1' },
    });
    const tx1 = signTransaction(unsignedTx1, policeSigner);

    const block1 = forgeBlock({ previousBlock: gen!, transactions: [tx1], proposerNode: 'POLICE_NODE' });
    const proposal1 = createBlockProposal({
      proposerNode: policeIdentity,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });
    const e11 = createBlockEndorsement({ endorserNode: policeIdentity, proposal: proposal1 });
    const e12 = createBlockEndorsement({ endorserNode: prosecutionIdentity, proposal: proposal1 });

    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: proposal1.proposalId,
      blockHash: block1.blockHash,
      chainId: 'nyayavault-mainnet-1',
      blockHeight: '1',
      policyId: 'STANDARD_ANCHOR',
      policyVersion: '1.0',
      requiredThreshold: 2,
      requiredNodeIds: ['POLICE_NODE'],
      endorsingSignatures: [
        {
          nodeId: 'POLICE_NODE',
          keyVersion: e11.keyVersion,
          keyFingerprint: e11.keyFingerprint,
          publicKeyPem: policeIdentity.keys[0].publicKeyPem,
          signatureHex: e11.signatureHex,
          signedAt: e11.signedAt,
        },
        {
          nodeId: 'PROSECUTION_NODE',
          keyVersion: e12.keyVersion,
          keyFingerprint: e12.keyFingerprint,
          publicKeyPem: prosecutionIdentity.keys[0].publicKeyPem,
          signatureHex: e12.signatureHex,
          signedAt: e12.signedAt,
        },
      ],
      collectedAt: new Date().toISOString(),
      commitTimestamp: new Date().toISOString(),
    };

    await runtime1.ledgerEngine.appendBlock(block1);
    expect(await runtime1.ledgerEngine.getHeight()).toBe(1n);

    // 2. Shut down node runtime 1
    runtime1.stop();

    // 3. Instantiate node runtime 2 using SAME mockPrisma persistent database
    const store2 = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const runtime2 = new NodeRuntime({
      nodeIdentity: policeIdentity,
      nodeRegistry: registry,
      ledgerStore: store2,
      transport,
      chainId: 'nyayavault-mainnet-1',
    });

    // 4. Start runtime 2 (triggers complete chain rehydration)
    await runtime2.start();

    expect(runtime2.lifecycleState).toBe('READY');
    expect(await runtime2.ledgerEngine.getHeight()).toBe(1n);

    const rehydratedBlock1 = await runtime2.ledgerEngine.getBlockByHeight(1n);
    expect(rehydratedBlock1?.blockHash).toBe(block1.blockHash);
    expect(rehydratedBlock1?.transactions[0].txId).toBe(tx1.txId);

    // 5. Continue block production: commit block 2 on runtime 2
    const unsignedTx2 = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 2,
      payload: { caseId: 'CASE-REHYDRATE-2' },
    });
    const tx2 = signTransaction(unsignedTx2, policeSigner);

    const block2 = forgeBlock({ previousBlock: rehydratedBlock1!, transactions: [tx2], proposerNode: 'POLICE_NODE' });
    const proposal2 = createBlockProposal({
      proposerNode: policeIdentity,
      block: block2,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });
    const e21 = createBlockEndorsement({ endorserNode: policeIdentity, proposal: proposal2 });
    const e22 = createBlockEndorsement({ endorserNode: prosecutionIdentity, proposal: proposal2 });

    block2.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: proposal2.proposalId,
      blockHash: block2.blockHash,
      chainId: 'nyayavault-mainnet-1',
      blockHeight: '2',
      policyId: 'STANDARD_ANCHOR',
      policyVersion: '1.0',
      requiredThreshold: 2,
      requiredNodeIds: ['POLICE_NODE'],
      endorsingSignatures: [
        {
          nodeId: 'POLICE_NODE',
          keyVersion: e21.keyVersion,
          keyFingerprint: e21.keyFingerprint,
          publicKeyPem: policeIdentity.keys[0].publicKeyPem,
          signatureHex: e21.signatureHex,
          signedAt: e21.signedAt,
        },
        {
          nodeId: 'PROSECUTION_NODE',
          keyVersion: e22.keyVersion,
          keyFingerprint: e22.keyFingerprint,
          publicKeyPem: prosecutionIdentity.keys[0].publicKeyPem,
          signatureHex: e22.signatureHex,
          signedAt: e22.signedAt,
        },
      ],
      collectedAt: new Date().toISOString(),
      commitTimestamp: new Date().toISOString(),
    };

    await runtime2.ledgerEngine.appendBlock(block2);
    expect(await runtime2.ledgerEngine.getHeight()).toBe(2n);

    runtime2.stop();
  });
});
