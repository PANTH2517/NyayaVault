/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/physical-node-config.ts
 *
 * Environment-Driven Physical Node Configuration & Validation Module
 */

import { NodeType } from '../identity/types';

export const ALLOWED_NODE_TYPES: NodeType[] = [
  'POLICE_NODE',
  'PROSECUTION_NODE',
  'COURT_NODE',
  'ADMIN_NODE',
];

export interface PhysicalNodeConfigOptions {
  nodeId: NodeType;
  chainId: string;
  listenHost: string;
  listenPort: number;
  peerUrls: Map<NodeType, string>;
  peerAllowlist: Set<NodeType>;
  requestTimeoutMs: number;
  maxMessageAgeMs: number;
  privateKeyPem?: string;
}

export class PhysicalNodeConfig {
  public readonly nodeId: NodeType;
  public readonly chainId: string;
  public readonly listenHost: string;
  public readonly listenPort: number;
  public readonly peerUrls: Map<NodeType, string>;
  public readonly peerAllowlist: Set<NodeType>;
  public readonly requestTimeoutMs: number;
  public readonly maxMessageAgeMs: number;
  public readonly privateKeyPem?: string;
  public readonly appServiceSecret?: string;

  constructor(options: PhysicalNodeConfigOptions & { appServiceSecret?: string }) {
    if (!ALLOWED_NODE_TYPES.includes(options.nodeId)) {
      throw new Error(
        `INVALID_NODE_ID: Node ID '${options.nodeId}' is not allowed. Must be one of: ${ALLOWED_NODE_TYPES.join(
          ', ',
        )}`,
      );
    }

    this.nodeId = options.nodeId;
    this.chainId = options.chainId || 'nyayavault-mainnet-1';
    this.listenHost = options.listenHost || '0.0.0.0';
    this.listenPort = options.listenPort || 5001;
    this.peerUrls = options.peerUrls;
    this.peerAllowlist = options.peerAllowlist;
    this.requestTimeoutMs = options.requestTimeoutMs || 10000;
    this.maxMessageAgeMs = options.maxMessageAgeMs || 300000; // 5 minutes
    this.privateKeyPem = options.privateKeyPem;
    this.appServiceSecret = options.appServiceSecret;
  }

  /**
   * Load physical node configuration from process environment variables
   */
  static fromEnv(env: Record<string, string | undefined> = process.env): PhysicalNodeConfig {
    const rawNodeId = (env.BLOCKCHAIN_NODE_ID || env.BLOCKCHAIN_NODE_TYPE || '').trim() as NodeType;

    if (!rawNodeId) {
      throw new Error(
        `MISSING_NODE_ID: Environment variable BLOCKCHAIN_NODE_ID is required (e.g. POLICE_NODE)`,
      );
    }

    if (!ALLOWED_NODE_TYPES.includes(rawNodeId)) {
      throw new Error(
        `UNSUPPORTED_NODE_TYPE: Node type '${rawNodeId}' is invalid. Supported values: ${ALLOWED_NODE_TYPES.join(
          ', ',
        )}`,
      );
    }

    const chainId = env.BLOCKCHAIN_CHAIN_ID || 'nyayavault-mainnet-1';
    const listenHost = env.BLOCKCHAIN_LISTEN_HOST || '0.0.0.0';
    const listenPort = parseInt(env.PORT || env.BLOCKCHAIN_LISTEN_PORT || '5001', 10);

    // Parse Peer URLs (Format: POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002)
    const peerUrls = new Map<NodeType, string>();
    const rawPeerUrls = env.BLOCKCHAIN_PEER_URLS || '';

    if (rawPeerUrls) {
      const entries = rawPeerUrls.split(',');
      for (const entry of entries) {
        const [nodeIdStr, url] = entry.split('=').map((s) => s.trim());
        if (nodeIdStr && url && ALLOWED_NODE_TYPES.includes(nodeIdStr as NodeType)) {
          peerUrls.set(nodeIdStr as NodeType, url);
        }
      }
    }

    // Parse Peer Allowlist (Format: POLICE_NODE,PROSECUTION_NODE,COURT_NODE,ADMIN_NODE)
    const peerAllowlist = new Set<NodeType>();
    const rawAllowlist = env.BLOCKCHAIN_PEER_ALLOWLIST || ALLOWED_NODE_TYPES.join(',');

    for (const item of rawAllowlist.split(',')) {
      const trimmed = item.trim() as NodeType;
      if (ALLOWED_NODE_TYPES.includes(trimmed)) {
        peerAllowlist.add(trimmed);
      }
    }

    const requestTimeoutMs = parseInt(env.BLOCKCHAIN_REQUEST_TIMEOUT_MS || '10000', 10);
    const maxMessageAgeMs = parseInt(env.BLOCKCHAIN_MAX_MESSAGE_AGE_MS || '300000', 10);
    const rawKey = env.BLOCKCHAIN_NODE_PRIVATE_KEY_PEM || env.BLOCKCHAIN_NODE_KEY_PEM;
    const privateKeyPem = rawKey && rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    const appServiceSecret = env.BLOCKCHAIN_APP_SERVICE_SECRET;

    return new PhysicalNodeConfig({
      nodeId: rawNodeId,
      chainId,
      listenHost,
      listenPort,
      peerUrls,
      peerAllowlist,
      requestTimeoutMs,
      maxMessageAgeMs,
      privateKeyPem,
      appServiceSecret,
    });
  }

  isPeerAllowed(peerNodeId: NodeType): boolean {
    return this.peerAllowlist.has(peerNodeId);
  }

  getPeerUrl(peerNodeId: NodeType): string | null {
    return this.peerUrls.get(peerNodeId) || null;
  }
}
