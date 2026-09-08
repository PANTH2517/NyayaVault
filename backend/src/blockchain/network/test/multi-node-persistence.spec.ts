/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/multi-node-persistence.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { PrismaLedgerStore } from '../../ledger/prisma-ledger-store';
import { createMockPrismaClient } from '../../ledger/test/mock-prisma-client';

describe('Multi-Node Persistent Storage Isolation Engine', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
  });

  it('maintains complete storage isolation across 4 permissioned organizational nodes in single database', async () => {
    const mockPrisma = createMockPrismaClient();

    const policeStore = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const prosStore = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'PROSECUTION_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const courtStore = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'COURT_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const adminStore = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'ADMIN_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    // Initialize genesis on all 4 node stores
    const polGen = await policeStore.initialize();
    const prosGen = await prosStore.initialize();
    const courtGen = await courtStore.initialize();
    const adminGen = await adminStore.initialize();

    expect(polGen.blockHash).toBe(prosGen.blockHash);

    // Commit block 1 ONLY on POLICE_NODE
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
      payload: { caseId: 'CASE-ISOLATION-101' },
    });
    const tx = signTransaction(unsignedTx, policeSigner);

    const block1 = forgeBlock({ previousBlock: polGen, transactions: [tx], proposerNode: 'POLICE_NODE' });
    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: 'prop-iso-1',
      blockHash: block1.blockHash,
      chainId: 'nyayavault-mainnet-1',
      blockHeight: '1',
      policyId: 'STANDARD_ANCHOR',
      policyVersion: '1.0',
      requiredThreshold: 2,
      requiredNodeIds: ['POLICE_NODE'],
      endorsingSignatures: [],
      collectedAt: new Date().toISOString(),
      commitTimestamp: new Date().toISOString(),
    };

    await policeStore.appendBlock(block1);

    // POLICE_NODE height is 1
    expect(await policeStore.getHeight()).toBe(1n);

    // PROSECUTION_NODE, COURT_NODE, ADMIN_NODE heights remain 0 (isolated)
    expect(await prosStore.getHeight()).toBe(0n);
    expect(await courtStore.getHeight()).toBe(0n);
    expect(await adminStore.getHeight()).toBe(0n);

    // Verify block 1 does not exist in prosecution store
    expect(await prosStore.getBlockByHeight(1n)).toBeNull();
  });
});
