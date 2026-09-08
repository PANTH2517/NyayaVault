/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain-node.main.ts
 *
 * Dedicated Physical Blockchain Node Executable Process Entry Point
 */

import { PhysicalNodeConfig } from './blockchain/network/physical-node-config';
import { NodeServer } from './blockchain/network/node-server';
import { InMemoryNodeRegistry } from './blockchain/identity/in-memory-node-registry';
import { NodeKeyProvider } from './blockchain/identity/node-key-provider';
import { PrismaLedgerStore } from './blockchain/ledger/prisma-ledger-store';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  console.log('[BLOCKCHAIN_NODE] Initializing physical node process startup sequence...');

  let config: PhysicalNodeConfig;
  try {
    config = PhysicalNodeConfig.fromEnv(process.env);
  } catch (err: any) {
    console.error(`[BLOCKCHAIN_NODE_FATAL] Configuration validation failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`[BLOCKCHAIN_NODE] Loaded identity configuration: NodeID=${config.nodeId}, ChainID=${config.chainId}, ListenPort=${config.listenPort}`);

  const registry = new InMemoryNodeRegistry();

  // Load physical node identity and keys
  const identity = NodeKeyProvider.createNodeIdentity(
    config.nodeId,
    `NyayaVault ${config.nodeId}`,
    config.privateKeyPem,
  );
  registry.registerNode(identity);

  // Initialize persistence: Use Prisma store if DATABASE_URL is present, otherwise fallback to InMemory
  let store: any = undefined;
  if (process.env.DATABASE_URL) {
    console.log(`[BLOCKCHAIN_NODE] Initializing Prisma PostgreSQL persistence for node '${config.nodeId}'`);
    const prisma = new PrismaClient();
    store = new PrismaLedgerStore({
      prisma,
      nodeId: config.nodeId,
      chainId: config.chainId,
    });
  }

  const server = new NodeServer(config, registry, store);

  // Setup graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`[BLOCKCHAIN_NODE] Received ${signal}. Initiating graceful shutdown...`);
    try {
      await server.stop();
      console.log(`[BLOCKCHAIN_NODE] Physical node '${config.nodeId}' stopped cleanly.`);
      process.exit(0);
    } catch (err: any) {
      console.error(`[BLOCKCHAIN_NODE_ERROR] Shutdown error: ${err.message}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
    const state = await server.runtime.getNodeState();
    console.log(
      `[BLOCKCHAIN_NODE_READY] Node '${config.nodeId}' successfully started on http://${config.listenHost}:${config.listenPort}. LifecycleState=${server.runtime.lifecycleState}, CurrentHeight=${state.currentHeight}, TipHash=${state.latestBlockHash || 'GENESIS'}`,
    );
  } catch (err: any) {
    console.error(`[BLOCKCHAIN_NODE_FATAL] Startup fail-closed: Node '${config.nodeId}' failed startup checks: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();
