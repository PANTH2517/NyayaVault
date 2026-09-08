/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/four-node-orchestrator.ts
 *
 * Four-Node Physical Network Orchestrator & Launcher
 */

import { NodeType } from '../identity/types';
import { NodeKeyProvider } from '../identity/node-key-provider';
import { InMemoryNodeRegistry } from '../identity/in-memory-node-registry';
import { PhysicalNodeConfig } from './physical-node-config';
import { NodeServer } from './node-server';
import { ILedgerStore } from '../ledger/ledger-store.interface';
import { InMemoryLedgerStore } from '../ledger/in-memory-ledger-store';

export interface FourNodeOrchestratorOptions {
  basePort?: number;
  chainId?: string;
  appServiceSecret?: string;
  customStores?: Map<NodeType, ILedgerStore>;
}

export class FourNodeOrchestrator {
  public readonly nodeServers = new Map<NodeType, NodeServer>();
  public readonly nodeStores = new Map<NodeType, ILedgerStore>();
  public readonly registry = new InMemoryNodeRegistry();

  private readonly basePort: number;
  private readonly chainId: string;
  private readonly appServiceSecret: string;

  constructor(options: FourNodeOrchestratorOptions = {}) {
    this.basePort = options.basePort || 7000;
    this.chainId = options.chainId || 'nyayavault-mainnet-1';
    this.appServiceSecret = options.appServiceSecret || 'nyayavault-app-service-secret-2026';

    const nodeTypes: NodeType[] = ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'];
    const portMap = new Map<NodeType, number>([
      ['POLICE_NODE', this.basePort + 1],
      ['PROSECUTION_NODE', this.basePort + 2],
      ['COURT_NODE', this.basePort + 3],
      ['ADMIN_NODE', this.basePort + 4],
    ]);

    // Build peer URLs map
    const peerUrls = new Map<NodeType, string>();
    for (const type of nodeTypes) {
      peerUrls.set(type, `http://127.0.0.1:${portMap.get(type)}`);
    }

    const peerAllowlist = new Set<NodeType>(nodeTypes);

    // 1. Generate & register distinct secp256k1 key identities for all 4 authorities
    for (const type of nodeTypes) {
      const identity = NodeKeyProvider.createNodeIdentity(type, `NyayaVault ${type}`);
      this.registry.registerNode(identity);
    }

    // 2. Instantiate independent NodeServer for each authority
    for (const type of nodeTypes) {
      const port = portMap.get(type)!;
      const identity = this.registry.getNode(type)!;
      const store = options.customStores?.get(type) || new InMemoryLedgerStore(this.chainId);
      this.nodeStores.set(type, store);

      const config = new PhysicalNodeConfig({
        nodeId: type,
        chainId: this.chainId,
        listenHost: '127.0.0.1',
        listenPort: port,
        peerUrls,
        peerAllowlist,
        requestTimeoutMs: 10000,
        maxMessageAgeMs: 300000,
        privateKeyPem: identity.privateKeysByVersion.get(1),
        appServiceSecret: this.appServiceSecret,
      });

      const server = new NodeServer(config, this.registry, store);
      this.nodeServers.set(type, server);
    }
  }

  /**
   * Start all four physical node servers in parallel and await READY status
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.nodeServers.values()).map((server) => server.start());
    await Promise.all(startPromises);
  }

  /**
   * Stop all four physical node servers gracefully
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.nodeServers.values()).map((server) => server.stop());
    await Promise.all(stopPromises);
  }

  /**
   * Stop a single physical node server
   */
  async stopNode(nodeId: NodeType): Promise<void> {
    const server = this.nodeServers.get(nodeId);
    if (server) {
      await server.stop();
    }
  }

  /**
   * Restart a single physical node server (retaining its store instance)
   */
  async startNode(nodeId: NodeType): Promise<void> {
    const server = this.nodeServers.get(nodeId);
    if (server) {
      await server.start();
    }
  }

  /**
   * Check if all 4 nodes are in READY lifecycle state
   */
  async isAllReady(): Promise<boolean> {
    for (const server of this.nodeServers.values()) {
      if (server.runtime.lifecycleState !== 'READY') {
        return false;
      }
    }
    return true;
  }

  /**
   * Get specific NodeServer instance
   */
  getNodeServer(nodeId: NodeType): NodeServer | undefined {
    return this.nodeServers.get(nodeId);
  }
}

// CLI Execution Entrypoint if run directly
if (require.main === module) {
  console.log('[ORCHESTRATOR] Launching four physical NyayaVault PoA nodes on ports 7001-7004...');
  const orchestrator = new FourNodeOrchestrator();

  orchestrator
    .startAll()
    .then(async () => {
      console.log('[ORCHESTRATOR_SUCCESS] All 4 physical blockchain nodes are READY:');
      for (const [nodeId, server] of orchestrator.nodeServers.entries()) {
        const state = await server.runtime.getNodeState();
        console.log(`  - ${nodeId}: http://${server.config.listenHost}:${server.config.listenPort} | State=${server.runtime.lifecycleState} | Tip=${state.latestBlockHash || 'GENESIS'}`);
      }
    })
    .catch((err) => {
      console.error(`[ORCHESTRATOR_FATAL] Failed to launch 4-node network: ${err.message}`);
      process.exit(1);
    });

  const shutdown = async () => {
    console.log('\n[ORCHESTRATOR] Shutting down physical nodes...');
    await orchestrator.stopAll();
    console.log('[ORCHESTRATOR] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
