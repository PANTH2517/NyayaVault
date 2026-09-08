/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/test/domain-signer.spec.ts
 */

import { generateSecp256k1KeyPair } from '../../ledger/crypto';
import { computePublicKeyFingerprint } from '../fingerprint';
import { signDomainPayload, verifyDomainPayload } from '../domain-signer';
import { NodeIdentity } from '../types';

describe('Domain-Separated Signing & Verification', () => {
  let policeKeypair: { publicKeyPem: string; privateKeyPem: string };
  let policeNode: NodeIdentity;

  beforeEach(() => {
    policeKeypair = generateSecp256k1KeyPair();
    const fingerprint = computePublicKeyFingerprint(policeKeypair.publicKeyPem);

    const privateKeys = new Map<number, string>();
    privateKeys.set(1, policeKeypair.privateKeyPem);

    policeNode = {
      nodeId: 'POLICE_NODE',
      organization: 'State Police Department',
      currentVersion: 1,
      keys: [
        {
          version: 1,
          publicKeyPem: policeKeypair.publicKeyPem,
          fingerprint,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
      ],
      privateKeysByVersion: privateKeys,
    };
  });

  it('should sign payload under transaction domain and verify cleanly', () => {
    const payload = JSON.stringify({ documentId: 'doc-1', hash: 'sha256-abc' });
    const signed = signDomainPayload(policeNode, 'NYAYAVAULT_TX_V1', payload);

    expect(signed.domain).toEqual('NYAYAVAULT_TX_V1');
    expect(signed.nodeId).toEqual('POLICE_NODE');
    expect(signed.signatureHex).toBeDefined();

    const isValid = verifyDomainPayload(
      policeKeypair.publicKeyPem,
      'NYAYAVAULT_TX_V1',
      payload,
      signed.signatureHex,
    );
    expect(isValid).toBe(true);
  });

  it('should fail verification if verified under a different signing domain (Domain Separation)', () => {
    const payload = JSON.stringify({ documentId: 'doc-1', hash: 'sha256-abc' });
    const signed = signDomainPayload(policeNode, 'NYAYAVAULT_TX_V1', payload);

    // Verify same signature under NYAYAVAULT_BLOCK_V1 domain -> MUST FAIL
    const isValid = verifyDomainPayload(
      policeKeypair.publicKeyPem,
      'NYAYAVAULT_BLOCK_V1',
      payload,
      signed.signatureHex,
    );
    expect(isValid).toBe(false);
  });

  it('should reject signing if key status is REVOKED', () => {
    policeNode.keys[0].status = 'REVOKED';

    const payload = JSON.stringify({ documentId: 'doc-1' });
    expect(() => {
      signDomainPayload(policeNode, 'NYAYAVAULT_TX_V1', payload);
    }).toThrow(/is 'REVOKED'/);
  });
});
