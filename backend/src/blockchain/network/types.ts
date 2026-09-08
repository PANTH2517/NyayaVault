/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/types.ts
 *
 * Core Domain Types for Sub-Phase 1C Multi-Node Peer Network & Synchronization
 */

import { NodeType } from '../identity/types';

export type NetworkMessageType =
  | 'HELLO_HANDSHAKE'
  | 'HELLO_RESPONSE'
  | 'STATUS_REQUEST'
  | 'STATUS_RESPONSE'
  | 'BLOCK_REQUEST'
  | 'BLOCK_RESPONSE'
  | 'CHAIN_REQUEST'
  | 'CHAIN_RESPONSE'
  | 'BLOCK_PROPOSAL'
  | 'BLOCK_ENDORSEMENT'
  | 'CONSENSUS_COMMIT'
  | 'CONSENSUS_REJECT'
  | 'PING'
  | 'PONG';


export type PeerSyncState = 'IDLE' | 'SYNCING' | 'DIVERGED' | 'ERROR';

export interface PeerRecord {
  nodeId: NodeType;
  organization: string;
  publicKeyPem: string;
  keyFingerprint: string;
  endpoint: string; // HTTP(S) URL or internal P2P transport address
  isEnabled: boolean;
  protocolVersion: string;
}

export interface NodeNetworkStatus {
  nodeId: NodeType;
  chainId: string;
  currentHeight: string;
  latestBlockHash: string;
  genesisHash: string;
  protocolVersion: string;
  timestamp: string;
}

export interface NetworkMessageEnvelope {
  protocolVersion: string;
  messageType: NetworkMessageType;
  messageId: string; // UUID v4 or deterministic SHA-256 hash
  chainId: string;
  senderNodeId: NodeType;
  senderKeyVersion: number;
  senderKeyFingerprint: string;
  timestamp: string; // ISO 8601 UTC
  nonce: string;
  payload: Record<string, any>;
  signatureHex: string;
}

export interface PeerHealthStatus {
  peerNodeId: NodeType;
  isReachable: boolean;
  isAuthenticated: boolean;
  currentHeight: string;
  latestBlockHash: string;
  lastContactAt: string;
  syncState: PeerSyncState;
}

export interface DivergenceResult {
  diverged: boolean;
  code?: string;
  reason?: string;
  localHeight?: string;
  peerHeight?: string;
  localBlockHash?: string;
  peerBlockHash?: string;
}

export interface HandshakePayload {
  chainId: string;
  senderNodeId: NodeType;
  keyVersion: number;
  keyFingerprint: string;
  nonce: string;
  timestamp: string;
}

export interface StatusRequestPayload {
  requestedAt: string;
}

export interface StatusResponsePayload {
  nodeId: NodeType;
  chainId: string;
  currentHeight: string;
  latestBlockHash: string;
  genesisHash: string;
  protocolVersion: string;
  timestamp: string;
}

export interface BlockRequestPayload {
  height?: string;
  blockHash?: string;
}

export interface BlockResponsePayload {
  found: boolean;
  block?: any;
}

export interface ChainRequestPayload {
  fromHeight: string;
  limit: number;
}

export interface ChainResponsePayload {
  fromHeight: string;
  count: number;
  blocks: any[];
  currentHeight: string;
}

export interface NodeRuntimeState {
  nodeId: NodeType;
  chainId: string;
  currentHeight: string;
  latestBlockHash: string;
  peerHealth: PeerHealthStatus[];
  syncState: PeerSyncState;
  lastSyncTimestamp: string;
  lastError?: string;
  nodeKeyVersion: number;
}

export interface BlockProposalPayload {
  proposal: any;
}

export interface BlockEndorsementPayload {
  endorsement: any;
}

export interface ConsensusCommitPayload {
  block: any;
  proof: any;
}

export interface ConsensusRejectPayload {
  proposalId: string;
  reason: string;
  code?: string;
}



