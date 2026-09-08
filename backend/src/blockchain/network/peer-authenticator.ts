/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/peer-authenticator.ts
 *
 * Peer Handshake Authentication & Replay Prevention Module
 */

import { hashSha256 } from '../ledger/crypto';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity } from '../identity/types';
import { VerificationResult } from '../ledger/types';
import { createNetworkEnvelope, verifyNetworkEnvelope } from './envelope';
import { HandshakePayload, NetworkMessageEnvelope } from './types';


export class PeerAuthenticator {
  private readonly seenNonces: Set<string> = new Set();

  constructor(
    private readonly localNode: NodeIdentity,
    private readonly nodeRegistry: INodeRegistry,
    private readonly chainId: string,
  ) {}

  /**
   * Create an authenticated HELLO_HANDSHAKE message envelope
   */
  createHandshakeEnvelope(): NetworkMessageEnvelope {
    const nonce = hashSha256(`${this.localNode.nodeId}-${Date.now()}-${Math.random()}`);

    const payload: HandshakePayload = {
      chainId: this.chainId,
      senderNodeId: this.localNode.nodeId,
      keyVersion: this.localNode.currentVersion,
      keyFingerprint: this.nodeRegistry.getActiveKey(this.localNode.nodeId)?.fingerprint || '',
      nonce,
      timestamp: new Date().toISOString(),
    };

    return createNetworkEnvelope({
      senderNode: this.localNode,
      messageType: 'HELLO_HANDSHAKE',
      chainId: this.chainId,
      payload,
      nonce,
    });
  }

  /**
   * Authenticate incoming peer HELLO_HANDSHAKE envelope
   */
  authenticateHandshake(envelope: NetworkMessageEnvelope): VerificationResult {
    if (envelope.messageType !== 'HELLO_HANDSHAKE' && envelope.messageType !== 'HELLO_RESPONSE') {
      return {
        valid: false,
        code: 'INVALID_HANDSHAKE_MESSAGE_TYPE',
        reason: `Expected HELLO_HANDSHAKE or HELLO_RESPONSE, received '${envelope.messageType}'`,
      };
    }

    // 1. Verify envelope cryptographic signature & sender status
    const envelopeValidation = verifyNetworkEnvelope(envelope, this.nodeRegistry, this.chainId);
    if (!envelopeValidation.valid) {
      return envelopeValidation;
    }

    // 2. Replay Prevention: Check if nonce or messageId was already processed
    const nonceKey = `${envelope.senderNodeId}:${envelope.nonce}`;
    if (this.seenNonces.has(nonceKey) || this.seenNonces.has(envelope.messageId)) {
      return {
        valid: false,
        code: 'REPLAYED_HANDSHAKE',
        reason: `Handshake nonce or messageId already processed for node '${envelope.senderNodeId}'`,
      };
    }

    this.seenNonces.add(nonceKey);
    this.seenNonces.add(envelope.messageId);

    // Limit seen nonces memory footprint
    if (this.seenNonces.size > 10000) {
      this.seenNonces.clear();
    }

    return { valid: true };
  }
}
