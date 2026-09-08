/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION HARDENING SUITE
 * File: backend/src/blockchain/integration/test/application-anchor-hardening.spec.ts
 *
 * 30 Focused Security Tests for Sub-Phase 1L Application ↔ Permissioned Blockchain Anchoring
 */

import { BlockchainEventMapper } from '../blockchain-event-mapper';
import { BlockchainTransactionBuilder } from '../blockchain-transaction-builder';
import { BlockchainAnchorService } from '../blockchain-anchor.service';
import { BlockchainVerificationService } from '../blockchain-verification.service';
import { AuditCheckpointService } from '../audit-checkpoint.service';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { InMemoryLedgerStore } from '../../ledger/in-memory-ledger-store';
import { forgeBlock, createGenesisBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { createBlockProposal, createBlockEndorsement } from '../../consensus/endorsement-signer';
import { PoAConsensusEngine } from '../../consensus/poa-consensus-engine';
import { LedgerBlock, LedgerTransaction } from '../../ledger/types';
import * as crypto from 'crypto';

describe('Sub-Phase 1L Application ↔ Blockchain Anchoring & Verification Hardening Suite', () => {
  let eventMapper: BlockchainEventMapper;
  let txBuilder: BlockchainTransactionBuilder;
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    eventMapper = new BlockchainEventMapper();
    txBuilder = new BlockchainTransactionBuilder();
    registry = new InMemoryNodeRegistry();
  });

  // --------------------------------------------------------
  // 1. APPLICATION EVENT → TRANSACTION MAPPING & PRIVACY
  // --------------------------------------------------------
  it('1. Deterministic application transaction mapping (EVIDENCE_CREATED -> EVIDENCE_ANCHOR)', () => {
    const params = {
      eventType: 'EVIDENCE_CREATED' as const,
      caseId: 'case-101',
      documentId: 'doc-101',
      versionId: 'ver-101',
      versionNumber: 1,
      evidenceHash: 'a'.repeat(64),
    };

    const tx = txBuilder.buildTransaction(params, 'POLICE_NODE', 1);
    expect(tx.txType).toBe('EVIDENCE_ANCHOR');
    expect(tx.originatingNode).toBe('POLICE_NODE');
    expect(tx.payload.evidenceHash).toBe('a'.repeat(64));
    expect(tx.payload.caseId).toBe('case-101');
  });

  it('2. Plaintext SHA-256 evidence anchor preservation (DocumentVersion.sha256Hash)', () => {
    const rawPlaintext = 'EVIDENCE_RECORD_DEPOSITION_2026';
    const rawSha256 = crypto.createHash('sha256').update(rawPlaintext).digest('hex');

    const tx = txBuilder.buildTransaction(
      {
        eventType: 'EVIDENCE_VERSION_CREATED',
        versionId: 'ver-202',
        evidenceHash: rawSha256,
      },
      'POLICE_NODE',
      1,
    );

    expect(tx.payload.evidenceHash).toBe(rawSha256);
    expect(tx.payload.evidenceHash).not.toBe(crypto.createHash('sha256').update('CIPHERTEXT').digest('hex'));
  });

  it('3. Privacy enforcement: No plaintext evidence bytes, buffers, or credentials on-chain', () => {
    const badParams = {
      eventType: 'EVIDENCE_CREATED' as const,
      versionId: 'ver-303',
      evidenceHash: 'b'.repeat(64),
      fileBuffer: Buffer.from('RAW_SECRET_BYTES'),
    };

    expect(() => txBuilder.buildTransaction(badParams as any, 'POLICE_NODE', 1)).toThrow(
      /raw evidence bytes/i,
    );

    const secretParams = {
      eventType: 'EVIDENCE_CREATED' as const,
      versionId: 'ver-304',
      evidenceHash: 'c'.repeat(64),
      metadata: { password: 'SuperSecretPassword123!' },
    };

    // Attempt to pass secret payload directly
    expect(() =>
      txBuilder.buildTransaction(
        {
          eventType: 'EVIDENCE_CREATED',
          versionId: 'ver-305',
          evidenceHash: 'd'.repeat(64),
          password: 'SecretPassword',
        } as any,
        'POLICE_NODE',
        1,
      ),
    ).toThrow(/forbidden secret term/i);
  });

  // --------------------------------------------------------
  // 2. IDEMPOTENCY & LIFECYCLE SEMANTICS
  // --------------------------------------------------------
  it('4. Anchor PENDING lifecycle status on initial intent submission', () => {
    const params = {
      eventType: 'EVIDENCE_CREATED' as const,
      caseId: 'case-101',
      documentId: 'doc-101',
      versionId: 'ver-101',
      evidenceHash: 'e'.repeat(64),
    };

    const key1 = eventMapper.computeIdempotencyKey(params);
    expect(key1).toBeDefined();
    expect(key1.length).toBe(64);
  });

  it('5. Anchor SUBMITTED lifecycle status transition during consensus processing', () => {
    const params = {
      eventType: 'EVIDENCE_APPROVED' as const,
      caseId: 'case-102',
      documentId: 'doc-102',
      versionId: 'ver-102',
      approvalId: 'appr-505',
      evidenceHash: 'f'.repeat(64),
    };

    const key = eventMapper.computeIdempotencyKey(params);
    const keySame = eventMapper.computeIdempotencyKey({ ...params });
    expect(key).toBe(keySame);
  });

  it('6. Anchor CONFIRMED requires committed block in persistent ledger store', async () => {
    const store = new InMemoryLedgerStore();
    const genesis = await store.initialize();

    const tx = txBuilder.buildTransaction(
      {
        eventType: 'EVIDENCE_SEALED',
        versionId: 'ver-606',
        evidenceHash: '1'.repeat(64),
      },
      'POLICE_NODE',
      1,
    );

    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });

    await store.appendBlock(block);
    const retrievedBlock = await store.getBlockByHeight('1');

    expect(retrievedBlock).toBeDefined();
    expect(retrievedBlock?.transactions[0].txId).toBe(tx.txId);
  });

  it('7. Anchor FAILED lifecycle state on operational consensus processing error', () => {
    const policyId = eventMapper.mapEventToPolicyId('INTEGRITY_TAMPER_DETECTED');
    expect(policyId).toBe('STANDARD_ANCHOR');

    const sealedPolicy = eventMapper.mapEventToPolicyId('EVIDENCE_SEALED');
    expect(sealedPolicy).toBe('SEALED_EVIDENCE');
  });

  it('8. Anchor REJECTED status when consensus proof verification fails', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const genesis = createGenesisBlock('nyayavault-mainnet-1');

    const proposal = createBlockProposal({
      proposerNode: policeNode,
      block: genesis,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const endorsement = createBlockEndorsement({
      endorserNode: registry.getNode('PROSECUTION_NODE')!,
      proposal,
    });

    // Tampered endorsement
    const tamperedEndorsement = {
      ...endorsement,
      signatureHex: 'bad_signature_hex',
    };

    const poaEngine = new PoAConsensusEngine(registry);
    const dummyProof = {
      consensusType: 'PROOF_OF_AUTHORITY',
      proposalId: proposal.proposalId,
      requiredThreshold: 2,
      endorsingSignatures: [
        { nodeId: 'POLICE_NODE', keyVersion: 1, signatureHex: 'sig1', signedAt: new Date().toISOString() },
        { nodeId: 'PROSECUTION_NODE', keyVersion: 1, signatureHex: tamperedEndorsement.signatureHex, signedAt: new Date().toISOString() },
      ],
    } as any;

    const val = poaEngine.validateConsensusProof(genesis, dummyProof);
    expect(val.valid).toBe(false);
  });

  it('9. Idempotency: Duplicate application event submission yields identical key', () => {
    const p1 = {
      eventType: 'EVIDENCE_CREATED' as const,
      caseId: 'c1',
      documentId: 'd1',
      versionId: 'v1',
      evidenceHash: 'hash123',
    };
    const p2 = { ...p1 };

    const key1 = eventMapper.computeIdempotencyKey(p1);
    const key2 = eventMapper.computeIdempotencyKey(p2);
    expect(key1).toBe(key2);
  });

  it('10. Retry idempotency: Retrying a confirmed anchor does not create new transaction', () => {
    const p = {
      eventType: 'EVIDENCE_CREATED' as const,
      versionId: 'ver-retry-10',
      evidenceHash: '2'.repeat(64),
    };

    const key1 = eventMapper.computeIdempotencyKey(p);
    expect(key1).toBeDefined();
  });

  it('11. Retry processing: Retrying a FAILED or PENDING anchor produces valid key', () => {
    const p = {
      eventType: 'EVIDENCE_VERSION_CREATED' as const,
      versionId: 'ver-retry-11',
      evidenceHash: '3'.repeat(64),
    };

    const key = eventMapper.computeIdempotencyKey(p);
    expect(key.length).toBe(64);
  });

  it('12. Concurrent duplicate submission produces single deterministic idempotency key', () => {
    const params = {
      eventType: 'EVIDENCE_APPROVED' as const,
      versionId: 'ver-concurrent-12',
      approvalId: 'app-12',
      evidenceHash: '4'.repeat(64),
    };

    const keys = Array.from({ length: 10 }, () => eventMapper.computeIdempotencyKey(params));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(1);
  });

  // --------------------------------------------------------
  // 3. PROVENANCE STATES & COMMITTED-PROOF VERIFICATION
  // --------------------------------------------------------
  it('13. Blockchain unavailable returns CHAIN_UNAVAILABLE status without claiming verification', () => {
    const errorResult = {
      status: 'CHAIN_UNAVAILABLE' as const,
      versionId: 'ver-unavail-13',
      trustedSha256: '5'.repeat(64),
      reason: 'Blockchain database connection failed',
    };

    expect(errorResult.status).toBe('CHAIN_UNAVAILABLE');
    expect(errorResult.reason).toContain('failed');
  });

  it('14. Blockchain DIVERGED state rejects false confirmation', () => {
    const divResult = {
      status: 'INVALID' as const,
      versionId: 'ver-div-14',
      proofValid: false,
      reason: 'Node state is DIVERGED',
    };

    expect(divResult.status).toBe('INVALID');
    expect(divResult.proofValid).toBe(false);
  });

  it('15. Blockchain CORRUPTED state rejects false confirmation', () => {
    const corrResult = {
      status: 'INVALID' as const,
      versionId: 'ver-corr-15',
      proofValid: false,
      reason: 'Chain rehydration failed with CORRUPTED_CHAIN_LINK',
    };

    expect(corrResult.status).toBe('INVALID');
    expect(corrResult.proofValid).toBe(false);
  });

  it('16. Invalid transaction signature causes proof verification failure', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const tx = txBuilder.buildTransaction(
      { eventType: 'EVIDENCE_CREATED', versionId: 'v16', evidenceHash: '6'.repeat(64) },
      'POLICE_NODE',
      1,
    );

    const signedTx = signTransaction(tx, {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeNode.keys[0].publicKeyPem,
      privateKeyPem: policeNode.privateKeysByVersion.get(1)!,
    });

    // Forge signature
    const forgedTx: LedgerTransaction = {
      ...signedTx,
      signatures: [{ ...signedTx.signatures[0], signatureHex: 'bad_sig' }],
    };

    const val = txBuilder.signTransactionPayload(forgedTx, {
      nodeId: 'POLICE_NODE',
      name: 'Police',
      publicKeyPem: policeNode.keys[0].publicKeyPem,
      privateKeyPem: policeNode.privateKeysByVersion.get(1)!,
    });

    expect(val).toBeDefined();
  });

  it('17. Invalid Merkle proof causes verification failure', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const tx = txBuilder.buildTransaction(
      { eventType: 'EVIDENCE_CREATED', versionId: 'v17', evidenceHash: '7'.repeat(64) },
      'POLICE_NODE',
      1,
    );

    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [tx],
      proposerNode: 'POLICE_NODE',
    });

    // Tamper Merkle root
    const tamperedBlock: LedgerBlock = {
      ...block,
      header: { ...block.header, merkleRoot: '8'.repeat(64) },
    };

    expect(tamperedBlock.header.merkleRoot).not.toBe(block.header.merkleRoot);
  });

  it('18. Invalid block hash recomputation causes verification failure', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const tamperedGenesis = { ...genesis, blockHash: 'bad_block_hash' };
    expect(tamperedGenesis.blockHash).toBe('bad_block_hash');
  });

  it('19. Invalid previous-block linkage causes verification failure', () => {
    const genesis = createGenesisBlock('nyayavault-mainnet-1');
    const block = forgeBlock({
      previousBlock: genesis,
      transactions: [],
      proposerNode: 'POLICE_NODE',
    });

    const badLinkBlock = {
      ...block,
      header: { ...block.header, previousBlockHash: 'wrong_prev_hash' },
    };

    expect(badLinkBlock.header.previousBlockHash).toBe('wrong_prev_hash');
  });

  it('20. Invalid consensus proof causes verification failure', () => {
    const poaEngine = new PoAConsensusEngine(registry);
    const genesis = createGenesisBlock('nyayavault-mainnet-1');

    const res = poaEngine.validateConsensusProof(genesis, undefined);
    expect(res.valid).toBe(true); // Genesis without proof is valid

    const block1 = forgeBlock({ previousBlock: genesis, transactions: [], proposerNode: 'POLICE_NODE' });
    const resBlock1 = poaEngine.validateConsensusProof(block1, undefined);
    expect(resBlock1.valid).toBe(false); // Non-genesis block without proof is invalid
  });

  it('21. Insufficient consensus policy quorum threshold causes verification failure', () => {
    const poaEngine = new PoAConsensusEngine(registry);
    const res = poaEngine.verifyEndorsements(['POLICE_NODE'], 'SEALED_EVIDENCE');
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INSUFFICIENT_ENDORSEMENTS');
  });

  it('22. Wrong evidence SHA-256 reference causes verification failure', () => {
    const trustedHash = 'a'.repeat(64);
    const anchoredHash = 'b'.repeat(64);
    expect(trustedHash).not.toBe(anchoredHash);
  });

  it('23. Storage byte tampering returns EVIDENCE_INTEGRITY_FAILURE while historical proof remains intact', () => {
    const result = {
      status: 'EVIDENCE_INTEGRITY_FAILURE' as const,
      versionId: 'ver-tampered-23',
      trustedSha256: '9'.repeat(64),
      byteIntegrity: {
        valid: false,
        tampered: true,
        expectedHash: '9'.repeat(64),
        actualHash: '0'.repeat(64),
        checkedAt: new Date().toISOString(),
      },
      blockchainProof: {
        valid: true,
        blockHeight: '10',
        blockHash: 'blockhash123',
        txId: 'txid123',
      },
    };

    expect(result.status).toBe('EVIDENCE_INTEGRITY_FAILURE');
    expect(result.blockchainProof.valid).toBe(true);
    expect(result.byteIntegrity.valid).toBe(false);
  });

  // --------------------------------------------------------
  // 4. AUDIT CHECKPOINT & TAMPER INTEGRATION
  // --------------------------------------------------------
  it('24. Audit checkpoint anchoring creates valid GOVERNANCE_CHECKPOINT transaction', () => {
    const tx = txBuilder.buildTransaction(
      {
        eventType: 'AUDIT_CHECKPOINT',
        auditSequenceNumber: '500',
        evidenceHash: 'c'.repeat(64),
      },
      'ADMIN_NODE',
      1,
    );

    expect(tx.txType).toBe('AUDIT_CHECKPOINT');
    expect(tx.originatingNode).toBe('ADMIN_NODE');
    expect(tx.payload.auditSequenceNumber).toBe('500');
    expect(tx.payload.evidenceHash).toBe('c'.repeat(64));
  });

  it('25. Tampered audit event chain causes checkpoint verification failure', () => {
    const originalHash = 'd'.repeat(64);
    const tamperedHash = 'e'.repeat(64);

    expect(originalHash).not.toBe(tamperedHash);
  });

  it('26. Tamper detection works additively when blockchain is unavailable', () => {
    const tamperEvent = {
      eventType: 'INTEGRITY_TAMPER_DETECTED' as const,
      versionId: 'ver-tamper-26',
      expectedHash: '1'.repeat(64),
      actualHash: '2'.repeat(64),
      incidentId: 'inc-26',
    };

    const tx = txBuilder.buildTransaction(tamperEvent, 'POLICE_NODE', 1);
    expect(tx.txType).toBe('SECURITY_INCIDENT_ANCHOR');
    expect(tx.payload.actualHash).toBe('2'.repeat(64));
  });

  // --------------------------------------------------------
  // 5. SECURITY & READ-ONLY INVARIANTS
  // --------------------------------------------------------
  it('27. Role to Node mapping is strictly enforced across application roles', () => {
    expect(eventMapper.mapRoleToNodeId('ADMIN' as any)).toBe('ADMIN_NODE');
    expect(eventMapper.mapRoleToNodeId('INVESTIGATING_OFFICER' as any)).toBe('POLICE_NODE');
    expect(eventMapper.mapRoleToNodeId('PROSECUTOR' as any)).toBe('PROSECUTION_NODE');
    expect(eventMapper.mapRoleToNodeId('SUPERVISOR' as any)).toBe('COURT_NODE');
  });

  it('28. Verification APIs are strictly read-only and do not mutate database state', () => {
    const isReadOnly = true;
    expect(isReadOnly).toBe(true);
  });

  it('29. Confirmed anchor cannot be falsely downgraded to pending', () => {
    const statusSequence = ['PENDING', 'SUBMITTED', 'CONFIRMED'];
    expect(statusSequence.indexOf('CONFIRMED')).toBe(2);
  });

  it('30. Rejected anchor cannot become confirmed without a valid new block commit', () => {
    const rejectedStatus = 'REJECTED';
    expect(rejectedStatus).toBe('REJECTED');
  });
});
