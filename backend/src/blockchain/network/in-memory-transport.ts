/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/in-memory-transport.ts
 *
 * In-Memory P2P Transport Dispatcher (Simulates Isolated Peer Message Routing)
 */

import { NodeType } from '../identity/types';
import { INodeTransport } from './transport.interface';
import { NetworkMessageEnvelope } from './types';

export class InMemoryNodeTransportDispatcher implements INodeTransport {
  private handlers: Map<
    NodeType,
    (msg: NetworkMessageEnvelope) => Promise<NetworkMessageEnvelope | null>
  > = new Map();

  registerHandler(
    nodeId: NodeType,
    handler: (msg: NetworkMessageEnvelope) => Promise<NetworkMessageEnvelope | null>,
  ): void {
    this.handlers.set(nodeId, handler);
  }

  unregisterHandler(nodeId: NodeType): void {
    this.handlers.delete(nodeId);
  }

  async sendMessage(
    targetNodeId: NodeType,
    message: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null> {
    const handler = this.handlers.get(targetNodeId);

    if (!handler) {
      // Node is unreachable or offline
      return null;
    }

    // Deep clone message envelope to guarantee complete memory isolation between sender and receiver
    const serialized = JSON.stringify(message);
    const deserializedEnvelope: NetworkMessageEnvelope = JSON.parse(serialized);

    const response = await handler(deserializedEnvelope);

    if (!response) {
      return null;
    }

    // Deep clone response envelope to guarantee return memory isolation
    return JSON.parse(JSON.stringify(response));
  }
}
