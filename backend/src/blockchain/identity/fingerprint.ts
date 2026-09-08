/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/fingerprint.ts
 *
 * Deterministic Public-Key Fingerprint Module
 */

import { hashSha256 } from '../ledger/crypto';

/**
 * Compute a deterministic SHA-256 fingerprint of a public key PEM
 */
export function computePublicKeyFingerprint(publicKeyPem: string): string {
  if (!publicKeyPem) {
    throw new Error('Cannot compute fingerprint of empty public key');
  }

  // Normalize line endings and trim whitespace
  const normalizedKey = publicKeyPem.trim().replace(/\r\n/g, '\n');
  return hashSha256(normalizedKey);
}
