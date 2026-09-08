/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER TESTS
 * File: backend/src/blockchain/ledger/test/corruption.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { computeBlockHash, forgeBlock } from '../block';
import { createLedgerTransaction, signTransaction } from '../transaction';
import { LedgerNodeIdentity } from '../types';
import { PrismaLedgerStore } from '../prisma-ledger-store';
import { createMockPrismaClient } from './mock-prisma-client';
import { ChainRehydrationService } from '../chain-rehydration';
import { PoAConsensusEngine } from '../../consensus/poa-consensus-engine';

describe('Chain Rehydration Integrity & Fail-Closed Corruption Engine', () => {
  let registry: InMemoryNodeRegistry;
  let consensusEngine: PoAConsensusEngine;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    consensusEngine = new PoAConsensusEngine(registry);
  });

  async function createValidPersistedChain() {
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

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-CORRUPT-101' },
    });
    const tx = signTransaction(unsignedTx, policeSigner);

    const block1 = forgeBlock({ previousBlock: genesis, transactions: [tx], proposerNode: 'POLICE_NODE' });
    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      consensusVersion: '1.0',
      proposalId: 'prop-corrupt-1',
      blockHash: block1.blockHash,
      chainId: 'nyayavault-mainnet-1',
      blockHeight: '1',
      policyId: 'STANDARD_ANCHOR',
      policyVersion: '1.0',
      requiredThreshold: 1,
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
    return { mockPrisma, store, block1 };
  }

  it('fails rehydration on genesis block corruption (GENESIS_MISMATCH)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    // Corrupt genesis block hash
    const genKey = 'POLICE_NODE_nyayavault-mainnet-1_0';
    const genBlock = storage.blocks.get(genKey);
    genBlock.blockHash = 'f'.repeat(64);

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('GENESIS_MISMATCH');
  });

  it('fails rehydration on modified block hash (BLOCK_HASH_MISMATCH)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    // Modify block 1 hash in store
    const b1Key = 'POLICE_NODE_nyayavault-mainnet-1_1';
    const b1 = storage.blocks.get(b1Key);
    b1.blockHash = 'a'.repeat(64);

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('BLOCK_HASH_MISMATCH');
  });

  it('fails rehydration on modified transaction payload (MERKLE_ROOT_MISMATCH / INVALID_TRANSACTION)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    // Tamper transaction payload in database storage
    for (const t of storage.transactions.values()) {
      t.payload = { caseId: 'TAMPERED-PAYLOAD' };
    }

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(['MERKLE_ROOT_MISMATCH', 'INVALID_TRANSACTION_IN_BLOCK']).toContain(result.code);
  });

  it('fails rehydration on modified Merkle root (MERKLE_ROOT_MISMATCH)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    const b1Key = 'POLICE_NODE_nyayavault-mainnet-1_1';
    const b1 = storage.blocks.get(b1Key);
    b1.merkleRoot = '0'.repeat(64);
    b1.blockHash = computeBlockHash({
      height: b1.height.toString(),
      chainId: b1.chainId,
      version: b1.version,
      previousBlockHash: b1.previousBlockHash,
      merkleRoot: b1.merkleRoot,
      timestamp: b1.timestamp,
      proposerNode: b1.proposerNode,
    });

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('MERKLE_ROOT_MISMATCH');
  });

  it('fails rehydration on modified previousBlockHash (PREVIOUS_HASH_MISMATCH)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    const b1Key = 'POLICE_NODE_nyayavault-mainnet-1_1';
    const b1 = storage.blocks.get(b1Key);
    b1.previousBlockHash = '9'.repeat(64);

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('PREVIOUS_HASH_MISMATCH');
  });

  it('fails rehydration if consensus proof is deleted (MISSING_CONSENSUS_PROOF)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    // Clear proofs map
    storage.proofs.clear();

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('MISSING_CONSENSUS_PROOF');
  });

  it('fails rehydration if endorsement signature is corrupted (INVALID_CONSENSUS_PROOF)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    for (const e of storage.endorsements.values()) {
      e.signatureHex = '00'.repeat(64);
    }

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_CONSENSUS_PROOF');
  });

  it('fails rehydration on height gap injection (HEIGHT_GAP)', async () => {
    const { mockPrisma, store } = await createValidPersistedChain();
    const storage = mockPrisma._getRawStorage();

    // Change block 1 height to 2 in storage
    const b1Key = 'POLICE_NODE_nyayavault-mainnet-1_1';
    const b1 = storage.blocks.get(b1Key);
    b1.height = 2n;
    storage.blocks.delete(b1Key);
    storage.blocks.set('POLICE_NODE_nyayavault-mainnet-1_2', b1);

    // Update chain tip to 2
    const chainKey = 'POLICE_NODE_nyayavault-mainnet-1';
    storage.chains.get(chainKey).currentHeight = 2n;

    const service = new ChainRehydrationService(store, consensusEngine, 'POLICE_NODE');
    const result = await service.rehydrateChain();

    expect(result.valid).toBe(false);
    expect(result.code).toBe('HEIGHT_GAP');
  });
});
