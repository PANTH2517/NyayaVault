/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN IDENTITY
 * File: backend/src/blockchain/identity/node-key-provider.ts
 *
 * Secure Production Node Key Provider & Key Lifecycle Management
 */

import { generateSecp256k1KeyPair, KeyPairResult } from '../ledger/crypto';
import { computePublicKeyFingerprint } from './fingerprint';
import { NodeIdentity, NodeKeyRecord, NodeType, PublicNodeIdentity } from './types';

export class NodeKeyProvider {
  private static keyCache: Map<NodeType, KeyPairResult> = new Map();

  /**
   * Get or generate a deterministic, isolated secp256k1 keypair for a physical node ID
   */
  static getOrCreateNodeKeyPair(nodeId: NodeType, overridePrivateKeyPem?: string): KeyPairResult {
    if (overridePrivateKeyPem) {
      // Extract or compute corresponding public key from private key
      try {
        const privKey = overridePrivateKeyPem.includes('\\n')
          ? overridePrivateKeyPem.replace(/\\n/g, '\n')
          : overridePrivateKeyPem;
        const pubKeyObject = require('crypto').createPublicKey(privKey);
        const publicKeyPem = pubKeyObject.export({ type: 'spki', format: 'pem' }).toString();
        return { publicKeyPem, privateKeyPem: privKey };
      } catch (err: any) {
        throw new Error(`INVALID_PRIVATE_KEY_PEM: Failed to load key for '${nodeId}': ${err.message}`);
      }
    }

    if (this.keyCache.has(nodeId)) {
      return this.keyCache.get(nodeId)!;
    }

    const keypair = generateSecp256k1KeyPair();
    this.keyCache.set(nodeId, keypair);
    return keypair;
  }

  /**
   * Construct a complete NodeIdentity with in-memory private key map for signing
   */
  static createNodeIdentity(
    nodeId: NodeType,
    organization: string,
    overridePrivateKeyPem?: string,
  ): NodeIdentity {
    const keypair = this.getOrCreateNodeKeyPair(nodeId, overridePrivateKeyPem);
    const fingerprint = computePublicKeyFingerprint(keypair.publicKeyPem);
    const now = new Date().toISOString();

    const keyRecord: NodeKeyRecord = {
      version: 1,
      publicKeyPem: keypair.publicKeyPem,
      fingerprint,
      status: 'ACTIVE',
      createdAt: now,
      activatedAt: now,
    };

    const privateKeys = new Map<number, string>();
    privateKeys.set(1, keypair.privateKeyPem);

    return {
      nodeId,
      organization,
      currentVersion: 1,
      keys: [keyRecord],
      privateKeysByVersion: privateKeys,
    };
  }

  /**
   * Safely sanitize NodeIdentity for public consumption (Omits private key material)
   */
  static sanitizePublicIdentity(identity: NodeIdentity): PublicNodeIdentity {
    const activeKey = identity.keys.find(
      (k) => k.version === identity.currentVersion && k.status === 'ACTIVE',
    );

    return {
      nodeId: identity.nodeId,
      organization: identity.organization,
      currentVersion: identity.currentVersion,
      activeKey: activeKey ? { ...activeKey } : ({ version: 1, publicKeyPem: '', fingerprint: '', status: 'REVOKED', createdAt: '' } as NodeKeyRecord),
      keys: identity.keys.map((k) => ({ ...k })),
    };
  }
}
