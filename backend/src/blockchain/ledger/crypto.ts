/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/crypto.ts
 *
 * Cryptographic Primitives Module (ECDSA secp256k1 & SHA-256)
 */

import * as crypto from 'crypto';

export interface KeyPairResult {
  publicKeyPem: string;
  privateKeyPem: string;
}

/**
 * Generate an in-memory ECDSA secp256k1 keypair for node testing/identities
 */
export function generateSecp256k1KeyPair(): KeyPairResult {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}

/**
 * Compute SHA-256 hash in hexadecimal format
 */
export function hashSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Sign data string using ECDSA secp256k1 with SHA-256 digest
 */
export function signDataHex(canonicalData: string, privateKeyPem: string): string {
  const signer = crypto.createSign('SHA256');
  signer.update(canonicalData);
  signer.end();
  return signer.sign(privateKeyPem, 'hex');
}

/**
 * Verify ECDSA secp256k1 signature over canonical data string
 */
export function verifyDataSignatureHex(
  canonicalData: string,
  signatureHex: string,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalData);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureHex, 'hex');
  } catch (_) {
    return false;
  }
}
