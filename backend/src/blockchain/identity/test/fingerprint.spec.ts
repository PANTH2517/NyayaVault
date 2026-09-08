/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/test/fingerprint.spec.ts
 */

import { generateSecp256k1KeyPair } from '../../ledger/crypto';
import { computePublicKeyFingerprint } from '../fingerprint';

describe('Public Key Fingerprint Module', () => {
  it('should compute deterministic SHA-256 fingerprint for public key', () => {
    const keypair = generateSecp256k1KeyPair();
    const fp1 = computePublicKeyFingerprint(keypair.publicKeyPem);
    const fp2 = computePublicKeyFingerprint(keypair.publicKeyPem);

    expect(fp1).toBeDefined();
    expect(fp1.length).toBe(64);
    expect(fp1).toEqual(fp2);
  });

  it('should normalize CRLF/LF line endings to produce identical fingerprints', () => {
    const pemLf = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE\n-----END PUBLIC KEY-----';
    const pemCrlf = '-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE\r\n-----END PUBLIC KEY-----';

    const fpLf = computePublicKeyFingerprint(pemLf);
    const fpCrlf = computePublicKeyFingerprint(pemCrlf);

    expect(fpLf).toEqual(fpCrlf);
  });

  it('should produce different fingerprints for different public keys', () => {
    const kp1 = generateSecp256k1KeyPair();
    const kp2 = generateSecp256k1KeyPair();

    const fp1 = computePublicKeyFingerprint(kp1.publicKeyPem);
    const fp2 = computePublicKeyFingerprint(kp2.publicKeyPem);

    expect(fp1).not.toEqual(fp2);
  });
});
