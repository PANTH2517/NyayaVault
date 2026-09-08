/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/test/ledger-engine.spec.ts
 */

import { LedgerEngine } from '../ledger-engine';
import { createGenesisBlock, forgeBlock } from '../block';
import { createLedgerTransaction, signTransaction } from '../transaction';
import { generateSecp256k1KeyPair } from '../crypto';
import { LedgerNodeIdentity } from '../types';

describe('LedgerEngine & Standalone Blockchain Integration', () => {
  let engine: LedgerEngine;
  let policeNode: LedgerNodeIdentity;
  let prosNode: LedgerNodeIdentity;

  beforeEach(async () => {
    engine = new LedgerEngine({ chainId: 'nyayavault-test-1' });
    await engine.initialize();

    const kp1 = generateSecp256k1KeyPair();
    const kp2 = generateSecp256k1KeyPair();

    policeNode = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: kp1.publicKeyPem,
      privateKeyPem: kp1.privateKeyPem,
    };

    prosNode = {
      nodeId: 'PROSECUTION_NODE',
      name: 'Prosecution Node',
      publicKeyPem: kp2.publicKeyPem,
      privateKeyPem: kp2.privateKeyPem,
    };
  });

  it('should initialize cleanly with deterministic genesis block at height 0', async () => {
    const height = await engine.getHeight();
    expect(height).toEqual(0n);

    const genesis = await engine.getBlockByHeight(0n);
    expect(genesis).toBeDefined();
    expect(genesis?.header.previousBlockHash).toEqual(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('should forge and append a valid block containing signed transactions', async () => {
    const genesis = (await engine.getLatestBlock())!;

    let tx = createLedgerTransaction({
      chainId: 'nyayavault-test-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-101', sha256Hash: 'hash101' },
    });

    tx = signTransaction(tx, policeNode);
    tx = signTransaction(tx, prosNode);

    const candidateBlock = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
      timestamp: new Date().toISOString(),
    });

    // Attach valid PoA consensus proof
    candidateBlock.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      requiredThreshold: 2,
      endorsingSignatures: tx.signatures,
    };

    const result = await engine.appendBlock(candidateBlock);
    expect(result.valid).toBe(true);

    const newHeight = await engine.getHeight();
    expect(newHeight).toEqual(1n);

    const verifyResult = await engine.verifyChain();
    expect(verifyResult.valid).toBe(true);
  });

  it('should reject block with duplicate transaction ID', async () => {
    const genesis = (await engine.getLatestBlock())!;

    let tx = createLedgerTransaction({
      chainId: 'nyayavault-test-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-101', sha256Hash: 'hash101' },
    });

    tx = signTransaction(tx, policeNode);
    tx = signTransaction(tx, prosNode);

    const block1 = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });
    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      requiredThreshold: 2,
      endorsingSignatures: tx.signatures,
    };

    await engine.appendBlock(block1);

    // Try to append block2 with exact same transaction tx
    const latest = (await engine.getLatestBlock())!;
    const block2 = forgeBlock({
      previousBlock: latest,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });
    block2.consensusProof = block1.consensusProof;

    const result2 = await engine.appendBlock(block2);
    expect(result2.valid).toBe(false);
    expect(result2.code).toEqual('DUPLICATE_TRANSACTION');
  });

  it('should detect tampered block hash during chain verification', async () => {
    const genesis = (await engine.getLatestBlock())!;

    let tx = createLedgerTransaction({
      chainId: 'nyayavault-test-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-101', sha256Hash: 'hash101' },
    });
    tx = signTransaction(tx, policeNode);
    tx = signTransaction(tx, prosNode);

    const block1 = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });
    block1.consensusProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      requiredThreshold: 2,
      endorsingSignatures: tx.signatures,
    };

    await engine.appendBlock(block1);

    // Corrupt block1 in store manually
    const storeBlock = await engine.getBlockByHeight(1n);
    storeBlock!.blockHash = 'corrupted-block-hash-12345678901234567890123456789012';

    const verifyResult = await engine.verifyChain();
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.code).toEqual('CORRUPTED_CHAIN_LINK');
  });
});
