/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/test/node-registry.spec.ts
 */

import { InMemoryNodeRegistry } from '../in-memory-node-registry';
import { signDomainPayload } from '../domain-signer';
import { generateSecp256k1KeyPair } from '../../ledger/crypto';

describe('InMemoryNodeRegistry (Key Rotation, Revocation & Authorization)', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry(true);
  });

  it('should pre-populate all 4 organization nodes with active keypairs', () => {
    const police = registry.getNode('POLICE_NODE');
    const pros = registry.getNode('PROSECUTION_NODE');
    const court = registry.getNode('COURT_NODE');
    const admin = registry.getNode('ADMIN_NODE');

    expect(police).toBeDefined();
    expect(pros).toBeDefined();
    expect(court).toBeDefined();
    expect(admin).toBeDefined();

    expect(registry.isAuthorized('POLICE_NODE')).toBe(true);
    expect(registry.isAuthorized('PROSECUTION_NODE')).toBe(true);
    expect(registry.isAuthorized('COURT_NODE')).toBe(true);
    expect(registry.isAuthorized('ADMIN_NODE')).toBe(true);

    const activeNodes = registry.listActiveNodes();
    expect(activeNodes.length).toBe(4);
  });

  it('should rotate key for node, activating version 2 and preserving version 1', () => {
    const origKey = registry.getActiveKey('POLICE_NODE')!;
    expect(origKey.version).toBe(1);

    const newKeyRecord = registry.rotateNodeKey('POLICE_NODE');
    expect(newKeyRecord.version).toBe(2);
    expect(newKeyRecord.status).toBe('ACTIVE');

    const updatedActiveKey = registry.getActiveKey('POLICE_NODE')!;
    expect(updatedActiveKey.version).toBe(2);

    const v1Key = registry.getKeyByVersion('POLICE_NODE', 1)!;
    expect(v1Key).toBeDefined();
    expect(v1Key.fingerprint).toEqual(origKey.fingerprint);
  });

  it('should verify historical signatures signed with version 1 after rotating to version 2', () => {
    const police = registry.getNode('POLICE_NODE')!;
    const payload = JSON.stringify({ action: 'historical-event' });

    // Sign payload with version 1
    const v1Signed = signDomainPayload(police, 'NYAYAVAULT_TX_V1', payload, 1);

    // Rotate key to version 2
    registry.rotateNodeKey('POLICE_NODE');

    // Verify historical version 1 signature via registry -> MUST PASS
    const result = registry.verifySignedPayload(v1Signed, payload);
    expect(result.valid).toBe(true);
  });

  it('should revoke key version, preventing new signatures but allowing historical verification', () => {
    const police = registry.getNode('POLICE_NODE')!;
    const payload = JSON.stringify({ action: 'pre-revocation-event' });

    // Sign payload before revocation
    const preSigned = signDomainPayload(police, 'NYAYAVAULT_TX_V1', payload, 1);

    // Revoke key version 1
    registry.revokeNodeKey('POLICE_NODE', 1);

    // Attempting to create new signature with revoked key -> MUST FAIL
    expect(() => {
      signDomainPayload(police, 'NYAYAVAULT_TX_V1', payload, 1);
    }).toThrow(/is 'REVOKED'/);

    // Historical signature created prior to revocation -> STILL VERIFIES HISTORICALLY
    const result = registry.verifySignedPayload(preSigned, payload);
    expect(result.valid).toBe(true);
  });

  it('should prevent node masquerading (using wrong key for node identity)', () => {
    const police = registry.getNode('POLICE_NODE')!;
    const courtKeypair = generateSecp256k1KeyPair();

    const payload = JSON.stringify({ action: 'masquerade-attempt' });
    const signed = signDomainPayload(police, 'NYAYAVAULT_TX_V1', payload);

    // Tamper with key fingerprint in signature payload
    signed.keyFingerprint = 'tampered-fingerprint';

    const result = registry.verifySignedPayload(signed, payload);
    expect(result.valid).toBe(false);
    expect(result.code).toEqual('FINGERPRINT_MISMATCH');
  });

  it('should reject unrecognized node identities', () => {
    const fakeKeypair = generateSecp256k1KeyPair();
    const payload = JSON.stringify({ action: 'unrecognized' });

    const signed: any = {
      domain: 'NYAYAVAULT_TX_V1',
      payloadHash: 'hash',
      nodeId: 'UNKNOWN_NODE',
      keyVersion: 1,
      keyFingerprint: 'fp',
      signatureHex: 'sig',
      signedAt: new Date().toISOString(),
    };

    const result = registry.verifySignedPayload(signed, payload);
    expect(result.valid).toBe(false);
    expect(result.code).toEqual('UNRECOGNIZED_NODE');
  });
});
