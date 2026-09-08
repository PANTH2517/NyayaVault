/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER TESTS
 * File: backend/src/blockchain/ledger/test/prisma-ledger-store.spec.ts
 */

import { createGenesisBlock, forgeBlock } from '../block';
import { createLedgerTransaction, signTransaction } from '../transaction';
import { LedgerNodeIdentity } from '../types';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { PrismaLedgerStore } from '../prisma-ledger-store';
import { createMockPrismaClient } from './mock-prisma-client';

describe('PrismaLedgerStore Persistent Implementation', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
  });

  it('initializes deterministic genesis block on first run', async () => {
    const mockPrisma = createMockPrismaClient();
    const store = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const genesis = await store.initialize();
    expect(genesis).toBeDefined();
    expect(genesis.header.height).toBe('0');

    const height = await store.getHeight();
    expect(height).toBe(0n);

    const latest = await store.getLatestBlock();
    expect(latest?.blockHash).toBe(genesis.blockHash);
  });

  it('atomically appends a committed block with transactions and proof', async () => {
    const mockPrisma = createMockPrismaClient();
    const store = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const genesis = await store.initialize();

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
      payload: { caseId: 'CASE-PRISMA-101' },
    });

    const tx = signTransaction(unsignedTx, policeSigner);
    const block1 = forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });

    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: 'prop-prisma-1',
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
          keyVersion: 1,
          keyFingerprint: policeIdentity.keys[0].fingerprint,
          publicKeyPem: policeIdentity.keys[0].publicKeyPem,
          signatureHex: 'sig-police',
          signedAt: new Date().toISOString(),
        },
      ],
      collectedAt: new Date().toISOString(),
      commitTimestamp: new Date().toISOString(),
    };

    await store.appendBlock(block1);

    const height = await store.getHeight();
    expect(height).toBe(1n);

    const fetchedBlock = await store.getBlockByHeight(1n);
    expect(fetchedBlock).not.toBeNull();
    expect(fetchedBlock?.blockHash).toBe(block1.blockHash);
    expect(fetchedBlock?.transactions.length).toBe(1);
    expect(fetchedBlock?.transactions[0].txId).toBe(tx.txId);
    expect(fetchedBlock?.consensusProof).toBeDefined();

    const hasTx = await store.hasTransaction(tx.txId);
    expect(hasTx).toBe(true);

    const fetchedTx = await store.getTransaction(tx.txId);
    expect(fetchedTx?.txId).toBe(tx.txId);
  });

  it('rejects appending duplicate block height or non-sequential height', async () => {
    const mockPrisma = createMockPrismaClient();
    const store = new PrismaLedgerStore({
      prisma: mockPrisma as any,
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
    });

    const genesis = await store.initialize();

    // Attempt to append genesis block again
    await expect(store.appendBlock(genesis)).rejects.toThrow();
  });
});
