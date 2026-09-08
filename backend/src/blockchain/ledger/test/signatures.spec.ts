/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/test/signatures.spec.ts
 */

import { generateSecp256k1KeyPair, signDataHex, verifyDataSignatureHex } from '../crypto';
import { createLedgerTransaction, signTransaction, verifyTransaction } from '../transaction';
import { LedgerNodeIdentity } from '../types';

describe('Cryptographic Signatures & Node Identity (ECDSA secp256k1)', () => {
  let policeKeypair: { publicKeyPem: string; privateKeyPem: string };
  let policeNode: LedgerNodeIdentity;

  beforeAll(() => {
    policeKeypair = generateSecp256k1KeyPair();
    policeNode = {
      nodeId: 'POLICE_NODE',
      name: 'Police Law Enforcement Node',
      publicKeyPem: policeKeypair.publicKeyPem,
      privateKeyPem: policeKeypair.privateKeyPem,
    };
  });

  it('should generate valid secp256k1 keypair and sign/verify payload', () => {
    const payload = 'canonical-test-data';
    const sig = signDataHex(payload, policeKeypair.privateKeyPem);

    expect(sig).toBeDefined();
    expect(verifyDataSignatureHex(payload, sig, policeKeypair.publicKeyPem)).toBe(true);
  });

  it('should reject signature verification if payload is altered', () => {
    const payload = 'canonical-test-data';
    const sig = signDataHex(payload, policeKeypair.privateKeyPem);

    expect(verifyDataSignatureHex('altered-payload', sig, policeKeypair.publicKeyPem)).toBe(false);
  });

  it('should sign transaction and verify node signature cleanly', () => {
    const tx = createLedgerTransaction({
      chainId: 'test-chain',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-1', sha256Hash: 'abc123hash' },
    });

    const signedTx = signTransaction(tx, policeNode);

    expect(signedTx.signatures.length).toBe(1);
    expect(signedTx.signatures[0].nodeId).toBe('POLICE_NODE');

    const validation = verifyTransaction(signedTx);
    expect(validation.valid).toBe(true);
  });

  it('should detect altered transaction payload and fail signature validation', () => {
    const tx = createLedgerTransaction({
      chainId: 'test-chain',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { documentId: 'doc-1', sha256Hash: 'abc123hash' },
    });

    const signedTx = signTransaction(tx, policeNode);

    // Tamper with payload after signing
    signedTx.payload.sha256Hash = 'tampered-hash';

    const validation = verifyTransaction(signedTx);
    expect(validation.valid).toBe(false);
  });
});
