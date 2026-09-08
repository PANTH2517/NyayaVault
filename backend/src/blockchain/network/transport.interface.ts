/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/transport.interface.ts
 *
 * Peer Transport Abstraction Interface
 */

import { NodeType } from '../identity/types';
import { NetworkMessageEnvelope } from './types';

export interface INodeTransport {
  sendMessage(
    targetNodeId: NodeType,
    message: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null>;

  registerHandler(
    nodeId: NodeType,
    handler: (msg: NetworkMessageEnvelope) => Promise<NetworkMessageEnvelope | null>,
  ): void;

  unregisterHandler(nodeId: NodeType): void;
}
