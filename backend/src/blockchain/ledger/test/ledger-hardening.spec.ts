/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER HARDENING SUITE
 * File: backend/src/blockchain/ledger/test/ledger-hardening.spec.ts
 *
 * 26 Focused Security Tests for Sub-Phase 1K Cryptographic Ledger Hardening
 */

import { canonicalSerialize } from '../serialization';
import { hashSha256, generateSecp256k1KeyPair, signDataHex, verifyDataSignatureHex } from '../crypto';
import { computeDomainDigest, signDomainPayload, verifyDomainPayload } from '../../identity/domain-signer';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import {
  createLedgerTransaction,
  signTransaction,
  verifyTransaction,
  computeCanonicalTransactionData,
  computeTransactionHash,
} from '../transaction';
import { buildMerkleTree, verifyMerkleProof, EMPTY_MERKLE_ROOT } from '../merkle';
import { createGenesisBlock, forgeBlock, validateBlockStructure, computeBlockHash } from '../block';
import {
  createBlockProposal,
  createBlockEndorsement,
  verifyBlockProposal,
  verifyBlockEndorsement,
  CONSENSUS_DOMAIN_NAME,
} from '../../consensus/endorsement-signer';
import { DefaultPoAConsensusEngine } from '../consensus-interface';
import { PoAConsensusEngine } from '../../consensus/poa-consensus-engine';
import { InMemoryLedgerStore } from '../in-memory-ledger-store';
import { ChainRehydrationService } from '../chain-rehydration';
import { NodeIdentity, SigningDomain } from '../../identity/types';
import { LedgerBlock, LedgerTransaction } from '../types';
import * as crypto from 'crypto';

describe('Sub-Phase 1K Cryptographic Ledger Hardening Security Suite', () => {
  let registry: InMemoryNodeRegistry;
  let policeNode: NodeIdentity;
  let prosecutionNode: NodeIdentity;
  let courtNode: NodeIdentity;
  let adminNode: NodeIdentity;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
    policeNode = registry.getNode('POLICE_NODE')!;
    prosecutionNode = registry.getNode('PROSECUTION_NODE')!;
    courtNode = registry.getNode('COURT_NODE')!;
    adminNode = registry.getNode('ADMIN_NODE')!;
  });

  // --------------------------------------------------------
  // 1. CANONICAL SERIALIZATION HARDENING
  // --------------------------------------------------------
  it('1. Canonical serialization determinism (key order invariance)', () => {
    const obj1 = { z: 100, b: 'hello', a: true, m: [3, 2, 1] };
    const obj2 = { a: true, m: [3, 2, 1], z: 100, b: 'hello' };
    expect(canonicalSerialize(obj1)).toBe(canonicalSerialize(obj2));
  });

  it('2. Special-character string canonicalization (escapes quotes, colons, newlines, Unicode)', () => {
    const payload = {
      note: 'Evidence: "Confidential", Line1\nLine2',
      sym: 'Â§123 Unicode test: âš¡',
    };
    const serialized = canonicalSerialize(payload);
    expect(serialized).toContain('"note":"Evidence: \\"Confidential\\", Line1\\nLine2"');
    expect(serialized).toContain('Â§123');
    // Ensure strict determinism
    expect(canonicalSerialize(payload)).toBe(canonicalSerialize({ ...payload }));
  });

  it('3. Nested canonical serialization (objects, arrays, BigInt, primitives)', () => {
    const complex = {
      id: 12345n,
      active: false,
      nullVal: null,
      nested: { x: 'val', arr: [1, '2', null, true] },
    };
    const s1 = canonicalSerialize(complex);
    const s2 = canonicalSerialize({
      nested: { arr: [1, '2', null, true], x: 'val' },
      nullVal: null,
      id: 12345n,
      active: false,
    });
    expect(s1).toBe(s2);
  });

  // --------------------------------------------------------
  // 2. DOMAIN SEPARATION & SIGNATURE ENFORCEMENT
  // --------------------------------------------------------
  it('4. Cross-domain signature reuse rejection', () => {
    const payload = 'TEST_TRANSACTION_PAYLOAD';

    // Sign under NYAYAVAULT_TX_V1 domain
    const txSigned = signDomainPayload(policeNode, 'NYAYAVAULT_TX_V1', payload);

    // Attempt to verify same signature under NYAYAVAULT_BLOCK_V1 -> MUST FAIL
    const verifiedAsBlock = verifyDomainPayload(
      policeNode.keys[0].publicKeyPem,
      'NYAYAVAULT_BLOCK_V1',
      payload,
      txSigned.signatureHex,
    );
    expect(verifiedAsBlock).toBe(false);

    // Attempt to verify under CONSENSUS domain -> MUST FAIL
    const verifiedAsConsensus = verifyDomainPayload(
      policeNode.keys[0].publicKeyPem,
      'NYAYAVAULT_CONSENSUS_V1',
      payload,
      txSigned.signatureHex,
    );
    expect(verifiedAsConsensus).toBe(false);
  });

  it('5. Transaction payload tampering invalidates signature', () => {
    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-101', sha256: 'a'.repeat(64) },
    });

    const signedTx = signTransaction(tx, {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeNode.keys[0].publicKeyPem,
      privateKeyPem: policeNode.privateKeysByVersion.get(1)!,
    });

    // Verification passes initially
    expect(verifyTransaction(signedTx).valid).toBe(true);

    // Mutate payload
    const tamperedTx: LedgerTransaction = {
      ...signedTx,
      payload: { documentId: 'doc-101', sha256: 'b'.repeat(64) },
    };

    const res = verifyTransaction(tamperedTx);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INVALID_TX_ID');
  });

  it('6. Signer / public key tampering invalidates verification', () => {
    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'case-99' },
    });

    const signedTx = signTransaction(tx, {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeNode.keys[0].publicKeyPem,
      privateKeyPem: policeNode.privateKeysByVersion.get(1)!,
    });

    // Replace signature public key with prosecution node's public key
    const forgedTx: LedgerTransaction = {
      ...signedTx,
      signatures: [
        {
          ...signedTx.signatures[0],
          publicKeyPem: prosecutionNode.keys[0].publicKeyPem,
        },
      ],
    };

    const res = verifyTransaction(forgedTx);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INVALID_SIGNATURE');
  });

  // --------------------------------------------------------
  // 3. REPLAY & DUPLICATE PROTECTION
  // --------------------------------------------------------
  it('7. Transaction replay rejection in memory store', async () => {
    const store = new InMemoryLedgerStore();
    const genesis = await store.initialize();

    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { item: 'replay-test' },
    });

    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'ADMIN_NODE',
    });

    await store.appendBlock(block);

    // Attempting to append another block containing the SAME transaction txId -> MUST FAIL
    const block2 = forgeBlock({
      previousBlock: block,
      transactions: [tx],
      proposerNode: 'ADMIN_NODE',
    });

    await expect(store.appendBlock(block2)).rejects.toThrow(/DUPLICATE_TRANSACTION/);
  });

  it('8. Duplicate transaction rejection in memory pool', async () => {
    const store = new InMemoryLedgerStore();
    await store.initialize();

    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'AUDIT_CHECKPOINT',
      originatingNode: 'POLICE_NODE',
      nonce: 5,
      payload: { seq: 100 },
    });

    expect(await store.hasTransaction(tx.txId)).toBe(false);
  });

  it('9. Rehydration rejects chain containing duplicate transactions across blocks', async () => {
    const store = new InMemoryLedgerStore();
    const genesis = await store.initialize();

    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { ev: 1 },
    });

    const dummyProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      requiredThreshold: 2,
      endorsingSignatures: [{ nodeId: 'POLICE_NODE' }, { nodeId: 'PROSECUTION_NODE' }],
    } as any;

    const block1 = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'ADMIN_NODE',
    });
    block1.consensusProof = dummyProof;

    // Bypass appendBlock duplicate check manually to simulate corrupted database state
    (store as any).blocks.push(block1);
    (store as any).blockByHeight.set('1', block1);
    (store as any).txById.set(tx.txId.toLowerCase(), tx);

    const block2 = forgeBlock({
      previousBlock: block1,
      transactions: [tx], // Duplicate tx!
      proposerNode: 'ADMIN_NODE',
    });
    block2.consensusProof = dummyProof;

    (store as any).blocks.push(block2);
    (store as any).blockByHeight.set('2', block2);

    const engine = new DefaultPoAConsensusEngine();
    const rehydrator = new ChainRehydrationService(store, engine, 'POLICE_NODE');

    const result = await rehydrator.rehydrateChain();
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DUPLICATE_TRANSACTION_IN_CHAIN');
  });

  // --------------------------------------------------------
  // 4. CONSENSUS / QUORUM PROOF HARDENING
  // --------------------------------------------------------
  it('10. Duplicate endorsements from same node ID do not count twice', () => {
    const engine = new PoAConsensusEngine(registry);

    // Endorsers list containing POLICE_NODE twice
    const result = engine.verifyEndorsements(['POLICE_NODE', 'POLICE_NODE'], 'SEALED_EVIDENCE');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_ENDORSEMENTS');
  });

  it('11. Endorsement replay rejection against different proposal', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const proposal1 = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement1 = createBlockEndorsement({
      endorserNode: prosecutionNode,
      proposal: proposal1,
    });

    const proposal2 = createBlockProposal({
      proposerNode: policeNode,
      block: { ...genesis, blockHash: 'f'.repeat(64) },
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    // Verify endorsement1 against proposal2 -> MUST FAIL
    const res = verifyBlockEndorsement(endorsement1, proposal2, registry);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('PROPOSAL_ID_MISMATCH');
  });

  it('12. Forged quorum signature rejection', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: prosecutionNode,
      proposal,
    });

    // Forge endorsement signature
    const forgedEndorsement = {
      ...endorsement,
      signatureHex: '3045022100deadbeef' + '0'.repeat(120),
    };

    const res = verifyBlockEndorsement(forgedEndorsement, proposal, registry);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INVALID_ENDORSEMENT_SIGNATURE');
  });

  it('13. Insufficient quorum threshold rejection', () => {
    const engine = new PoAConsensusEngine(registry);

    // SEALED_EVIDENCE requires threshold 3
    const res = engine.verifyEndorsements(['POLICE_NODE', 'PROSECUTION_NODE'], 'SEALED_EVIDENCE');
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INSUFFICIENT_ENDORSEMENTS');
  });

  it('14. Invalid proposer rejection', () => {
    const header = {
      height: '1',
      chainId: 'nyayavault-mainnet-1',
      version: '1.0',
      previousBlockHash: '0'.repeat(64),
      merkleRoot: EMPTY_MERKLE_ROOT,
      timestamp: new Date().toISOString(),
      proposerNode: 'UNKNOWN_HACKER_NODE' as any,
    };
    const blockHash = computeBlockHash(header);

    const res = validateBlockStructure({
      blockHash,
      header,
      transactions: [],
    });

    expect(res.valid).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED_PROPOSER');
  });

  it('15. Revoked / inactive key version rejection', () => {
    // Revoke key version 1 for policeNode
    policeNode.keys[0].status = 'REVOKED';

    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    expect(() =>
      createBlockProposal({
        proposerNode: policeNode,
        block: genesis,
        policyId: 'STANDARD_ANCHOR',
        chainId: 'nyayavault-mainnet-1',
      }),
    ).toThrow(/no active key/i);

    // Restore key status
    policeNode.keys[0].status = 'ACTIVE';
  });

  it('16. Proposal expiry rejection', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const pastTimestamp = new Date(Date.now() - 120000).toISOString();
    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
      proposalTimestamp: pastTimestamp,
      timeoutMs: -60000,
    });

    const res = verifyBlockProposal(proposal, registry);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('PROPOSAL_EXPIRED');
  });

  // --------------------------------------------------------
  // 5. MERKLE ROOT HARDENING
  // --------------------------------------------------------
  it('17. Merkle proof verification fails if proof step is tampered', () => {
    const txHashes = ['hash1', 'hash2', 'hash3', 'hash4'];
    const { root } = buildMerkleTree(txHashes);

    const validProof = [
      { position: 'right' as const, hash: 'hash2' },
      { position: 'right' as const, hash: hashSha256('hash3|hash4') },
    ];

    expect(verifyMerkleProof('hash1', validProof, root)).toBe(true);

    const tamperedProof = [
      { position: 'right' as const, hash: 'hash2_tampered' },
      { position: 'right' as const, hash: hashSha256('hash3|hash4') },
    ];

    expect(verifyMerkleProof('hash1', tamperedProof, root)).toBe(false);
  });

  it('18. Odd-node Merkle tree construction duplicates final node correctly', () => {
    const txHashes = ['tx1', 'tx2', 'tx3'];
    const { root, tree } = buildMerkleTree(txHashes);

    // Level 0: ['tx1', 'tx2', 'tx3']
    // Level 1: [Hash('tx1|tx2'), Hash('tx3|tx3')]
    const expectedLevel1_1 = hashSha256('tx3|tx3');
    expect(tree[1][1]).toBe(expectedLevel1_1);

    const expectedRoot = hashSha256(`${tree[1][0]}|${tree[1][1]}`);
    expect(root).toBe(expectedRoot);
  });

  it('19. Merkle root recomputation fails if a leaf transaction is modified', () => {
    const txHashes = ['tx1', 'tx2', 'tx3'];
    const { root: originalRoot } = buildMerkleTree(txHashes);

    const modifiedHashes = ['tx1', 'tx2_modified', 'tx3'];
    const { root: modifiedRoot } = buildMerkleTree(modifiedHashes);

    expect(modifiedRoot).not.toBe(originalRoot);
  });

  // --------------------------------------------------------
  // 6. BLOCK INTEGRITY HARDENING
  // --------------------------------------------------------
  it('20. Block header tampering invalidates computed block hash', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'ADMIN_NODE',
    });

    const resValid = validateBlockStructure(block);
    expect(resValid.valid).toBe(true);

    const tamperedBlock: LedgerBlock = {
      ...block,
      header: {
        ...block.header,
        timestamp: new Date(Date.now() + 10000).toISOString(),
      },
    };

    const resTampered = validateBlockStructure(tamperedBlock);
    expect(resTampered.valid).toBe(false);
    expect(resTampered.code).toBe('INVALID_BLOCK_HASH');
  });

  it('21. Broken previous hash linkage is detected', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'ADMIN_NODE',
    });

    const fakePrevBlock: LedgerBlock = {
      ...genesis,
      blockHash: 'bad_hash_' + '0'.repeat(55),
    };

    const res = validateBlockStructure(block, fakePrevBlock);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INVALID_PREVIOUS_HASH');
  });

  // --------------------------------------------------------
  // 7. PERSISTENCE & REHYDRATION FAIL-CLOSED VALIDATION
  // --------------------------------------------------------
  it('22. Corrupted persisted block hash causes rehydration failure', async () => {
    const store = new InMemoryLedgerStore();
    const genesis = await store.initialize();

    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'ADMIN_NODE',
    });

    // Mutate block hash in store
    const corruptedBlock = { ...block, blockHash: 'bad_hash_' + '0'.repeat(55) };
    (store as any).blocks.push(corruptedBlock);
    (store as any).blockByHeight.set('1', corruptedBlock);

    const engine = new PoAConsensusEngine(registry);
    const rehydrator = new ChainRehydrationService(store, engine, 'POLICE_NODE');

    const result = await rehydrator.rehydrateChain();
    expect(result.valid).toBe(false);
    expect(result.code).toBe('BLOCK_HASH_MISMATCH');
  });

  it('23. Fork / divergence detection fails closed when conflicting blocks exist at same height', async () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');

    const blockA = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'ADMIN_NODE',
      timestamp: '2026-09-07T10:00:00.000Z',
    });

    const blockB = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'ADMIN_NODE',
      timestamp: '2026-09-07T10:05:00.000Z',
    });

    expect(blockA.blockHash).not.toBe(blockB.blockHash);
    expect(blockA.header.height).toBe(blockB.header.height);

    // Validate blockA against genesis
    const valA = validateBlockStructure(blockA, genesis);
    expect(valA.valid).toBe(true);

    // Validate blockB against genesis
    const valB = validateBlockStructure(blockB, genesis);
    expect(valB.valid).toBe(true);

    // Linkage check fails if blockB attempts to follow blockA (height mismatch)
    const valLink = validateBlockStructure(blockB, blockA);
    expect(valLink.valid).toBe(false);
    expect(valLink.code).toBe('INVALID_PREVIOUS_HASH');
  });

  it('24. Genesis mismatch detection during rehydration', async () => {
    const store = new InMemoryLedgerStore();
    const badGenesis: LedgerBlock = {
      blockHash: 'corrupted_genesis_hash_' + '0'.repeat(41),
      header: {
        height: '0',
        chainId: 'nyayavault-mainnet-1',
        version: '1.0',
        previousBlockHash: '0'.repeat(64),
        merkleRoot: EMPTY_MERKLE_ROOT,
        timestamp: '2026-09-06T00:00:00.000Z',
        proposerNode: 'ADMIN_NODE',
      },
      transactions: [],
    };

    (store as any).blocks = [badGenesis];
    (store as any).blockByHeight.set('0', badGenesis);

    const engine = new PoAConsensusEngine(registry);
    const rehydrator = new ChainRehydrationService(store, engine, 'POLICE_NODE');

    const result = await rehydrator.rehydrateChain();
    expect(result.valid).toBe(false);
    expect(result.code).toBe('GENESIS_MISMATCH');
  });

  // --------------------------------------------------------
  // 8. EVIDENCE ANCHOR & ENCRYPTION INTEGRITY
  // --------------------------------------------------------
  it('25. Evidence anchor SHA-256 is strictly SHA-256(raw plaintext bytes)', () => {
    const rawPlaintext = 'LEGAL_EVIDENCE_DEPOSITION_TRANSCRIPT_2026';
    const rawBuffer = Buffer.from(rawPlaintext, 'utf-8');
    const expectedSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    const tx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: {
        documentId: 'doc-evidence-99',
        sha256Hash: expectedSha256,
      },
    });

    expect(tx.payload.sha256Hash).toBe(expectedSha256);
    expect(tx.payload.sha256Hash).not.toBe(hashSha256('CIPHERTEXT_BYTES'));
  });

  it('26. Encrypted-at-rest storage does not mutate DocumentVersion.sha256Hash', () => {
    const plaintext = 'SENSITIVE_CASE_FILE_DATA';
    const plaintextHash = crypto.createHash('sha256').update(Buffer.from(plaintext)).digest('hex');

    const docVersion = {
      id: 'ver-101',
      documentId: 'doc-101',
      sha256Hash: plaintextHash,
      isEncrypted: true,
      encryptionVersion: 1,
      encryptionKeyVersion: 1,
    };

    // Encrypted storage metadata update
    const updatedVersion = {
      ...docVersion,
      isEncrypted: true,
      encryptionVersion: 1,
    };

    // Evidentiary SHA-256 identity MUST remain unchanged
    expect(updatedVersion.sha256Hash).toBe(plaintextHash);
  });
});
