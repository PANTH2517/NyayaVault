/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/http-transport.ts
 *
 * Real HTTP Authenticated Peer Transport Implementation
 */

import { NodeType } from '../identity/types';
import { INodeTransport } from './transport.interface';
import { NetworkMessageEnvelope } from './types';
import { verifyNetworkEnvelope } from './envelope';
import { computePublicKeyFingerprint } from '../identity/fingerprint';
import { INodeRegistry } from '../identity/node-registry.interface';

export interface HttpNodeTransportOptions {
  nodeId: NodeType;
  peerUrls: Map<NodeType, string>;
  peerAllowlist: Set<NodeType>;
  nodeRegistry: INodeRegistry;
  chainId?: string;
  requestTimeoutMs?: number;
}

export class HttpNodeTransport implements INodeTransport {
  private readonly nodeId: NodeType;
  private readonly peerUrls: Map<NodeType, string>;
  private readonly peerAllowlist: Set<NodeType>;
  private readonly nodeRegistry: INodeRegistry;
  private readonly chainId: string;
  private readonly requestTimeoutMs: number;

  private messageHandler?: (msg: NetworkMessageEnvelope) => Promise<NetworkMessageEnvelope | null>;

  constructor(options: HttpNodeTransportOptions) {
    this.nodeId = options.nodeId;
    this.peerUrls = options.peerUrls;
    this.peerAllowlist = options.peerAllowlist;
    this.nodeRegistry = options.nodeRegistry;
    this.chainId = options.chainId || 'nyayavault-mainnet-1';
    this.requestTimeoutMs = options.requestTimeoutMs || 10000;
  }

  registerHandler(
    nodeId: NodeType,
    handler: (msg: NetworkMessageEnvelope) => Promise<NetworkMessageEnvelope | null>,
  ): void {
    if (nodeId === this.nodeId) {
      this.messageHandler = handler;
    }
  }

  unregisterHandler(nodeId: NodeType): void {
    if (nodeId === this.nodeId) {
      this.messageHandler = undefined;
    }
  }

  /**
   * Send signed network message envelope over authenticated HTTP POST to peer node
   */
  async sendMessage(
    targetNodeId: NodeType,
    message: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null> {
    // 1. Peer Allowlist Check
    if (!this.peerAllowlist.has(targetNodeId)) {
      // Reject unauthorized target node
      return null;
    }

    // 2. Peer URL Lookup
    const peerUrl = this.peerUrls.get(targetNodeId);
    if (!peerUrl) {
      // Peer unconfigured or offline
      return null;
    }

    const endpoint = `${peerUrl.replace(/\/$/, '')}/api/v1/node/message`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'close',
          'X-Correlation-ID': message.messageId,
          'X-Sender-Node-ID': message.senderNodeId,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const responseEnvelope: NetworkMessageEnvelope = await response.json();

      // 3. Verify Response Envelope Cryptographic Signature & Authenticity
      let val = verifyNetworkEnvelope(responseEnvelope, this.nodeRegistry, this.chainId);
      if (!val.valid && (val.code === 'FINGERPRINT_MISMATCH' || val.code === 'UNREGISTERED_SENDER_NODE')) {
        await this.syncPeerIdentities();
        val = verifyNetworkEnvelope(responseEnvelope, this.nodeRegistry, this.chainId);
      }
      if (!val.valid) {
        return null; // Reject malformed or unauthenticated response
      }

      if (responseEnvelope.senderNodeId !== targetNodeId) {
        return null; // Reject node identity spoofing
      }

      return responseEnvelope;
    } catch (_) {
      // Fail closed on network error, connection refused, or timeout
      return null;
    }
  }

  /**
   * Fetch public identities from peers to populate local node registry with strict validation
   */
  async syncPeerIdentities(): Promise<void> {
    for (const [peerNodeId, peerUrl] of this.peerUrls.entries()) {
      if (peerNodeId === this.nodeId) continue;
      try {
        const endpoint = `${peerUrl.replace(/\/$/, '')}/api/v1/node/identity`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const publicNode = await resp.json();
          // Validate peer identity strictly before trusting
          if (
            publicNode &&
            publicNode.nodeId === peerNodeId &&
            typeof this.nodeRegistry.registerPublicNode === 'function'
          ) {
            const activeKey = publicNode.activeKey || (publicNode.keys && publicNode.keys.find((k: any) => k.status === 'ACTIVE'));
            if (activeKey && activeKey.publicKeyPem) {
              const expectedFingerprint = computePublicKeyFingerprint(activeKey.publicKeyPem);
              if (activeKey.fingerprint === expectedFingerprint) {
                this.nodeRegistry.registerPublicNode(publicNode);
              }
            }
          }
        }
      } catch (_) {}
    }
  }

  /**
   * Process incoming HTTP message envelope locally
   */
  async handleIncomingHttpRequest(
    envelope: NetworkMessageEnvelope,
  ): Promise<{ status: number; body: NetworkMessageEnvelope | { error: string } }> {
    if (!this.peerAllowlist.has(envelope.senderNodeId)) {
      return { status: 403, body: { error: `UNAUTHORIZED_PEER: Peer '${envelope.senderNodeId}' not in allowlist` } };
    }

    // Verify envelope validity with key sync fallback
    let val = verifyNetworkEnvelope(envelope, this.nodeRegistry, this.chainId);
    if (!val.valid && (val.code === 'FINGERPRINT_MISMATCH' || val.code === 'UNREGISTERED_SENDER_NODE')) {
      await this.syncPeerIdentities();
      val = verifyNetworkEnvelope(envelope, this.nodeRegistry, this.chainId);
    }
    if (!val.valid) {
      return { status: 401, body: { error: `AUTHENTICATION_FAILED: ${val.reason}` } };
    }

    if (!this.messageHandler) {
      return { status: 503, body: { error: 'SERVICE_UNAVAILABLE: Node runtime not listening' } };
    }

    const responseEnvelope = await this.messageHandler(envelope);

    if (!responseEnvelope) {
      return { status: 204, body: { error: 'NO_CONTENT' } };
    }

    return { status: 200, body: responseEnvelope };
  }
}
