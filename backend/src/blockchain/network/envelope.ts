/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/envelope.ts
 *
 * Network Message Envelope Builder & Verification Module
 */

import { canonicalSerialize } from '../ledger/serialization';
import { hashSha256 } from '../ledger/crypto';
import { computeDomainDigest, signDomainPayload, verifyDomainPayload } from '../identity/domain-signer';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity } from '../identity/types';
import { VerificationResult } from '../ledger/types';
import { NetworkMessageEnvelope, NetworkMessageType } from './types';

export const CURRENT_PROTOCOL_VERSION = '1.0';
export const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 Minutes max message age

export interface CreateEnvelopeParams {
  senderNode: NodeIdentity;
  messageType: NetworkMessageType;
  chainId: string;
  payload: Record<string, any>;
  messageId?: string;
  nonce?: string;
  timestamp?: string;
}

/**
 * Compute canonical payload string for envelope hash & signature
 */
export function computeCanonicalEnvelopeData(params: {
  protocolVersion: string;
  messageType: NetworkMessageType;
  messageId: string;
  chainId: string;
  senderNodeId: string;
  senderKeyVersion: number;
  timestamp: string;
  nonce: string;
  payload: Record<string, any>;
}): string {
  const content = {
    protocolVersion: params.protocolVersion,
    messageType: params.messageType,
    messageId: params.messageId,
    chainId: params.chainId,
    senderNodeId: params.senderNodeId,
    senderKeyVersion: params.senderKeyVersion,
    timestamp: params.timestamp,
    nonce: params.nonce,
    payload: params.payload,
  };

  return canonicalSerialize(content);
}

/**
 * Construct and sign a secure NetworkMessageEnvelope
 */
export function createNetworkEnvelope(params: CreateEnvelopeParams): NetworkMessageEnvelope {
  const protocolVersion = CURRENT_PROTOCOL_VERSION;
  const timestamp = params.timestamp || new Date().toISOString();
  const nonce = params.nonce || hashSha256(`${Date.now()}-${Math.random()}`);
  const messageId = params.messageId || hashSha256(`${params.senderNode.nodeId}-${timestamp}-${nonce}`);

  const activeKey = params.senderNode.keys.find(
    (k) => k.version === params.senderNode.currentVersion && k.status === 'ACTIVE',
  );

  if (!activeKey) {
    throw new Error(
      `Cannot create envelope: Node '${params.senderNode.nodeId}' has no active key for version ${params.senderNode.currentVersion}`,
    );
  }

  const canonicalData = computeCanonicalEnvelopeData({
    protocolVersion,
    messageType: params.messageType,
    messageId,
    chainId: params.chainId,
    senderNodeId: params.senderNode.nodeId,
    senderKeyVersion: params.senderNode.currentVersion,
    timestamp,
    nonce,
    payload: params.payload,
  });

  const signed = signDomainPayload(params.senderNode, 'NYAYAVAULT_CONSENSUS_V1', canonicalData);

  return {
    protocolVersion,
    messageType: params.messageType,
    messageId,
    chainId: params.chainId,
    senderNodeId: params.senderNode.nodeId,
    senderKeyVersion: params.senderNode.currentVersion,
    senderKeyFingerprint: activeKey.fingerprint,
    timestamp,
    nonce,
    payload: params.payload,
    signatureHex: signed.signatureHex,
  };
}


/**
 * Verify network envelope signature, timestamp freshness, and sender registry status
 */
export function verifyNetworkEnvelope(
  envelope: NetworkMessageEnvelope,
  registry: INodeRegistry,
  expectedChainId?: string,
): VerificationResult {
  // 1. Verify Chain ID match if specified
  if (expectedChainId && envelope.chainId !== expectedChainId) {
    return {
      valid: false,
      code: 'CHAIN_ID_MISMATCH',
      reason: `Message chainId '${envelope.chainId}' does not match expected '${expectedChainId}'`,
    };
  }

  // 2. Verify timestamp freshness (Replay / Stale Protection)
  const msgTime = new Date(envelope.timestamp).getTime();
  const now = Date.now();

  if (isNaN(msgTime) || Math.abs(now - msgTime) > MAX_MESSAGE_AGE_MS) {
    return {
      valid: false,
      code: 'MESSAGE_EXPIRED_OR_STALE',
      reason: `Message timestamp '${envelope.timestamp}' is outside acceptable window (${MAX_MESSAGE_AGE_MS}ms)`,
    };
  }

  // 3. Verify sender node is registered
  const senderNode = registry.getNode(envelope.senderNodeId);
  if (!senderNode) {
    return {
      valid: false,
      code: 'UNREGISTERED_SENDER_NODE',
      reason: `Sender node '${envelope.senderNodeId}' is not registered in network topology`,
    };
  }

  // 4. Verify sender key version
  const keyRecord = senderNode.keys.find((k) => k.version === envelope.senderKeyVersion);
  if (!keyRecord) {
    return {
      valid: false,
      code: 'UNKNOWN_SENDER_KEY_VERSION',
      reason: `Key version ${envelope.senderKeyVersion} not found for node '${envelope.senderNodeId}'`,
    };
  }

  // Key must be ACTIVE for signing new envelopes (revoked keys fail)
  if (keyRecord.status !== 'ACTIVE') {
    return {
      valid: false,
      code: 'REVOKED_OR_INACTIVE_KEY',
      reason: `Sender key version ${envelope.senderKeyVersion} for node '${envelope.senderNodeId}' is '${keyRecord.status}'`,
    };
  }

  // 5. Verify fingerprint match
  if (keyRecord.fingerprint !== envelope.senderKeyFingerprint) {
    return {
      valid: false,
      code: 'FINGERPRINT_MISMATCH',
      reason: `Sender key fingerprint mismatch for node '${envelope.senderNodeId}'`,
    };
  }

  // 6. Verify secp256k1 signature over canonical data
  const canonicalData = computeCanonicalEnvelopeData({
    protocolVersion: envelope.protocolVersion,
    messageType: envelope.messageType,
    messageId: envelope.messageId,
    chainId: envelope.chainId,
    senderNodeId: envelope.senderNodeId,
    senderKeyVersion: envelope.senderKeyVersion,
    timestamp: envelope.timestamp,
    nonce: envelope.nonce,
    payload: envelope.payload,
  });

  const isSigValid = verifyDomainPayload(
    keyRecord.publicKeyPem,
    'NYAYAVAULT_CONSENSUS_V1',
    canonicalData,
    envelope.signatureHex,
  );

  if (!isSigValid) {
    return {
      valid: false,
      code: 'INVALID_ENVELOPE_SIGNATURE',
      reason: `Envelope signature verification failed for node '${envelope.senderNodeId}'`,
    };
  }

  return { valid: true };
}
