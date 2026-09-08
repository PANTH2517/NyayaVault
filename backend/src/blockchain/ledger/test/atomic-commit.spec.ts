/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER TESTS
 * File: backend/src/blockchain/ledger/test/atomic-commit.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { forgeBlock } from '../block';
import { createLedgerTransaction, signTransaction } from '../transaction';
import { LedgerNodeIdentity } from '../types';
import { PrismaLedgerStore } from '../prisma-ledger-store';
import { createMockPrismaClient } from './mock-prisma-client';

describe('Atomic Transaction Commit Rollback Engine', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
  });

  it('rolls back entire transaction on commit failure, keeping previous tip and storage un-mutated', async () => {
    const mockPrisma = createMockPrismaClient();
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const store = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const genesis = await store.initialize();
    expect(await store.getHeight()).toBe(0n);

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-ATOMIC-1' },
    });
    const tx = signTransaction(unsignedTx, policeSigner);

    const block1 = forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });

    // Inject fault into mockPrisma transaction for blockchainConsensusProof.create
    const origProofCreate = mockPrisma.blockchainConsensusProof.create;
    mockPrisma.blockchainConsensusProof.create = async () => {
      throw new Error('SIMULATED_DATABASE_WRITE_FAILURE');
    };

    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: 'prop-atomic-1',
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

    // Append block should fail due to simulated database error
    await expect(store.appendBlock(block1)).rejects.toThrow('SIMULATED_DATABASE_WRITE_FAILURE');

    // Confirm complete rollback: store remains at genesis height 0
    const height = await store.getHeight();
    expect(height).toBe(0n);

    const latest = await store.getLatestBlock();
    expect(latest?.blockHash).toBe(genesis.blockHash);

    // Confirm block 1 is not in store
    const b1 = await store.getBlockByHeight(1n);
    expect(b1).toBeNull();

    // Confirm transaction is not in store
    const hasTx = await store.hasTransaction(tx.txId);
    expect(hasTx).toBe(false);
  });
});
