/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/domain-signer.ts
 *
 * Domain-Separated Cryptographic Signing & Verification Module
 */

import { hashSha256, signDataHex, verifyDataSignatureHex } from '../ledger/crypto';
import { computePublicKeyFingerprint } from './fingerprint';
import { NodeIdentity, SignedDomainPayload, SigningDomain } from './types';

export function computeDomainDigest(domain: SigningDomain, payload: string): string {
  const allowedDomains: SigningDomain[] = [
    'NYAYAVAULT_TX_V1',
    'NYAYAVAULT_BLOCK_V1',
    'NYAYAVAULT_CONSENSUS_V1',
    'NYAYAVAULT_NODE_REGISTRATION_V1',
  ];

  if (!allowedDomains.includes(domain)) {
    throw new Error(`UNSUPPORTED_SIGNING_DOMAIN: Domain '${domain}' is unknown or not allowed.`);
  }

  const payloadHash = hashSha256(payload);
  return `${domain}|${payloadHash}`;
}

/**
 * Sign payload using node's ECDSA secp256k1 key under an explicit signing domain
 */
export function signDomainPayload(
  nodeIdentity: NodeIdentity,
  domain: SigningDomain,
  payload: string,
  keyVersion?: number,
): SignedDomainPayload {
  const versionToUse = keyVersion || nodeIdentity.currentVersion;
  const keyRecord = nodeIdentity.keys.find((k) => k.version === versionToUse);

  if (!keyRecord) {
    throw new Error(
      `Cannot sign domain payload: Node '${nodeIdentity.nodeId}' has no key record for version ${versionToUse}`,
    );
  }

  if (keyRecord.status !== 'ACTIVE') {
    throw new Error(
      `Cannot sign domain payload: Key version ${versionToUse} for node '${nodeIdentity.nodeId}' is '${keyRecord.status}' (Must be ACTIVE)`,
    );
  }

  const privateKeyPem = nodeIdentity.privateKeysByVersion.get(versionToUse);
  if (!privateKeyPem) {
    throw new Error(
      `Cannot sign domain payload: Node '${nodeIdentity.nodeId}' lacks in-memory private key for version ${versionToUse}`,
    );
  }

  const domainDigest = computeDomainDigest(domain, payload);
  const payloadHash = hashSha256(payload);
  const signatureHex = signDataHex(domainDigest, privateKeyPem);

  return {
    domain,
    payloadHash,
    nodeId: nodeIdentity.nodeId,
    keyVersion: versionToUse,
    keyFingerprint: keyRecord.fingerprint,
    signatureHex,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify domain-separated signature against public key Pem
 */
export function verifyDomainPayload(
  publicKeyPem: string,
  domain: SigningDomain,
  payload: string,
  signatureHex: string,
): boolean {
  const domainDigest = computeDomainDigest(domain, payload);
  return verifyDataSignatureHex(domainDigest, signatureHex, publicKeyPem);
}
