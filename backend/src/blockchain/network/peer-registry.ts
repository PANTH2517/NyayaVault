/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/peer-registry.ts
 *
 * Peer Network Registry & Health Tracking Module
 */

import { NodeType } from '../identity/types';
import { PeerHealthStatus, PeerRecord, PeerSyncState } from './types';

export class PeerRegistry {
  private peers: Map<NodeType, PeerRecord> = new Map();
  private healthMap: Map<NodeType, PeerHealthStatus> = new Map();

  constructor(localNodeId: NodeType) {
    this.initializeDefaultPeers(localNodeId);
  }

  private initializeDefaultPeers(localNodeId: NodeType) {
    const defaultPeers: { nodeId: NodeType; organization: string; endpoint: string }[] = [
      { nodeId: 'POLICE_NODE', organization: 'State Law Enforcement Agency', endpoint: 'http://police-node.local:8545' },
      { nodeId: 'PROSECUTION_NODE', organization: 'Public Prosecutor Office', endpoint: 'http://prosecution-node.local:8545' },
      { nodeId: 'COURT_NODE', organization: 'Judicial High Court Registry', endpoint: 'http://court-node.local:8545' },
      { nodeId: 'ADMIN_NODE', organization: 'NyayaVault Governance Council', endpoint: 'http://admin-node.local:8545' },
    ];

    for (const peer of defaultPeers) {
      if (peer.nodeId === localNodeId) continue; // Do not register self as peer

      const record: PeerRecord = {
        nodeId: peer.nodeId,
        organization: peer.organization,
        publicKeyPem: '',
        keyFingerprint: '',
        endpoint: peer.endpoint,
        isEnabled: true,
        protocolVersion: '1.0',
      };

      const health: PeerHealthStatus = {
        peerNodeId: peer.nodeId,
        isReachable: false,
        isAuthenticated: false,
        currentHeight: '-1',
        latestBlockHash: '',
        lastContactAt: '',
        syncState: 'IDLE',
      };

      this.peers.set(peer.nodeId, record);
      this.healthMap.set(peer.nodeId, health);
    }
  }

  getPeer(nodeId: NodeType): PeerRecord | null {
    return this.peers.get(nodeId) || null;
  }

  getHealth(nodeId: NodeType): PeerHealthStatus | null {
    return this.healthMap.get(nodeId) || null;
  }

  updateHealth(
    nodeId: NodeType,
    update: Partial<PeerHealthStatus>,
  ): PeerHealthStatus {
    const current = this.healthMap.get(nodeId) || {
      peerNodeId: nodeId,
      isReachable: false,
      isAuthenticated: false,
      currentHeight: '-1',
      latestBlockHash: '',
      lastContactAt: '',
      syncState: 'IDLE',
    };

    const updated: PeerHealthStatus = {
      ...current,
      ...update,
      lastContactAt: update.lastContactAt || new Date().toISOString(),
    };

    this.healthMap.set(nodeId, updated);
    return updated;
  }

  listPeers(): PeerRecord[] {
    return Array.from(this.peers.values());
  }

  listHealth(): PeerHealthStatus[] {
    return Array.from(this.healthMap.values());
  }
}
