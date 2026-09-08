/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/in-memory-node-registry.ts
 *
 * In-Memory Implementation of INodeRegistry (Pre-populates 4 Organization Nodes)
 */

import { generateSecp256k1KeyPair, KeyPairResult } from '../ledger/crypto';
import { computePublicKeyFingerprint } from './fingerprint';
import { verifyDomainPayload } from './domain-signer';
import { INodeRegistry, VerifyNodeSignatureResult } from './node-registry.interface';
import {
  NodeIdentity,
  PublicNodeIdentity,
  NodeKeyRecord,
  NodeType,
  SignedDomainPayload,
} from './types';

export class InMemoryNodeRegistry implements INodeRegistry {
  private nodes: Map<NodeType, NodeIdentity> = new Map();

  constructor(autoInitialize = true) {
    if (autoInitialize) {
      this.initializeDefaultNodes();
    }
  }

  private initializeDefaultNodes() {
    const nodeConfigs: { nodeId: NodeType; organization: string }[] = [
      { nodeId: 'POLICE_NODE', organization: 'State Law Enforcement Agency' },
      { nodeId: 'PROSECUTION_NODE', organization: 'Public Prosecutor Office' },
      { nodeId: 'COURT_NODE', organization: 'Judicial High Court Registry' },
      { nodeId: 'ADMIN_NODE', organization: 'NyayaVault Governance Council' },
    ];

    for (const config of nodeConfigs) {
      const keypair = generateSecp256k1KeyPair();
      const fingerprint = computePublicKeyFingerprint(keypair.publicKeyPem);
      const createdAt = new Date().toISOString();

      const initialKeyRecord: NodeKeyRecord = {
        version: 1,
        publicKeyPem: keypair.publicKeyPem,
        fingerprint,
        status: 'ACTIVE',
        createdAt,
        activatedAt: createdAt,
      };

      const privateKeys = new Map<number, string>();
      privateKeys.set(1, keypair.privateKeyPem);

      const identity: NodeIdentity = {
        nodeId: config.nodeId,
        organization: config.organization,
        currentVersion: 1,
        keys: [initialKeyRecord],
        privateKeysByVersion: privateKeys,
      };

      this.nodes.set(config.nodeId, identity);
    }
  }

  getNode(nodeId: NodeType): NodeIdentity | null {
    return this.nodes.get(nodeId) || null;
  }

  getPublicNode(nodeId: NodeType): PublicNodeIdentity | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const activeKey = node.keys.find((k) => k.version === node.currentVersion && k.status === 'ACTIVE');
    if (!activeKey) return null;

    return {
      nodeId: node.nodeId,
      organization: node.organization,
      currentVersion: node.currentVersion,
      activeKey: { ...activeKey },
      keys: node.keys.map((k) => ({ ...k })),
    };
  }

  getActiveKey(nodeId: NodeType): NodeKeyRecord | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const activeKey = node.keys.find((k) => k.version === node.currentVersion && k.status === 'ACTIVE');
    return activeKey ? { ...activeKey } : null;
  }

  getKeyByVersion(nodeId: NodeType, version: number): NodeKeyRecord | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const keyRecord = node.keys.find((k) => k.version === version);
    return keyRecord ? { ...keyRecord } : null;
  }

  isAuthorized(nodeId: NodeType): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    const activeKey = node.keys.find((k) => k.version === node.currentVersion && k.status === 'ACTIVE');
    return !!activeKey;
  }

  registerNode(node: NodeIdentity): void {
    this.nodes.set(node.nodeId, node);
  }

  rotateNodeKey(nodeId: NodeType, newKeypair?: KeyPairResult): NodeKeyRecord {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Cannot rotate key: Node '${nodeId}' not registered`);
    }

    const keypair = newKeypair || generateSecp256k1KeyPair();
    const fingerprint = computePublicKeyFingerprint(keypair.publicKeyPem);
    const newVersion = node.currentVersion + 1;
    const now = new Date().toISOString();

    const newKeyRecord: NodeKeyRecord = {
      version: newVersion,
      publicKeyPem: keypair.publicKeyPem,
      fingerprint,
      status: 'ACTIVE',
      createdAt: now,
      activatedAt: now,
    };

    node.keys.push(newKeyRecord);
    node.privateKeysByVersion.set(newVersion, keypair.privateKeyPem);
    node.currentVersion = newVersion;

    return { ...newKeyRecord };
  }

  revokeNodeKey(nodeId: NodeType, version: number): NodeKeyRecord {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Cannot revoke key: Node '${nodeId}' not registered`);
    }

    const keyRecord = node.keys.find((k) => k.version === version);
    if (!keyRecord) {
      throw new Error(`Cannot revoke key: Version ${version} not found for node '${nodeId}'`);
    }

    if (keyRecord.status === 'REVOKED') {
      throw new Error(`Key version ${version} for node '${nodeId}' is already revoked`);
    }

    const now = new Date().toISOString();
    keyRecord.status = 'REVOKED';
    keyRecord.revokedAt = now;

    return { ...keyRecord };
  }

  verifySignedPayload(
    signedPayload: SignedDomainPayload,
    originalPayload: string,
  ): VerifyNodeSignatureResult {
    // 1. Check if node is recognized
    const node = this.nodes.get(signedPayload.nodeId);
    if (!node) {
      return {
        valid: false,
        code: 'UNRECOGNIZED_NODE',
        reason: `Node '${signedPayload.nodeId}' is not registered in network topology`,
      };
    }

    // 2. Lookup key version referenced in signature
    const keyRecord = node.keys.find((k) => k.version === signedPayload.keyVersion);
    if (!keyRecord) {
      return {
        valid: false,
        code: 'UNKNOWN_KEY_VERSION',
        reason: `Key version ${signedPayload.keyVersion} not found for node '${signedPayload.nodeId}'`,
      };
    }

    // 3. Verify public key fingerprint
    const computedFingerprint = computePublicKeyFingerprint(keyRecord.publicKeyPem);
    if (computedFingerprint !== signedPayload.keyFingerprint) {
      return {
        valid: false,
        code: 'FINGERPRINT_MISMATCH',
        reason: `Key fingerprint in payload '${signedPayload.keyFingerprint}' does not match registered public key fingerprint '${computedFingerprint}'`,
      };
    }

    // 4. Verify domain signature
    const isSigValid = verifyDomainPayload(
      keyRecord.publicKeyPem,
      signedPayload.domain,
      originalPayload,
      signedPayload.signatureHex,
    );

    if (!isSigValid) {
      return {
        valid: false,
        code: 'INVALID_DOMAIN_SIGNATURE',
        reason: `Domain signature verification failed for node '${signedPayload.nodeId}' under domain '${signedPayload.domain}'`,
      };
    }

    return { valid: true };
  }

  listActiveNodes(): PublicNodeIdentity[] {
    const list: PublicNodeIdentity[] = [];
    for (const nodeId of this.nodes.keys()) {
      const pub = this.getPublicNode(nodeId);
      if (pub) list.push(pub);
    }
    return list;
  }
}
