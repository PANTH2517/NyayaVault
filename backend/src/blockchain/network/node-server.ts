/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/node-server.ts
 *
 * Physical Node HTTP Server Process Wrapper
 */

import * as http from 'http';
import { NodeType } from '../identity/types';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeKeyProvider } from '../identity/node-key-provider';
import { NodeRuntime, NodeRuntimeConfig } from './node-runtime';
import { HttpNodeTransport } from './http-transport';
import { PhysicalNodeConfig } from './physical-node-config';
import { NetworkMessageEnvelope } from './types';

import { ILedgerStore } from '../ledger/ledger-store.interface';

export class NodeServer {
  public readonly config: PhysicalNodeConfig;
  public readonly nodeRegistry: INodeRegistry;
  public readonly runtime: NodeRuntime;
  public readonly transport: HttpNodeTransport;
  private httpServer?: http.Server;

  constructor(
    config: PhysicalNodeConfig,
    nodeRegistry: INodeRegistry,
    ledgerStore?: ILedgerStore,
  ) {
    this.config = config;
    this.nodeRegistry = nodeRegistry;

    // Ensure node identity is initialized in registry
    let identity = this.nodeRegistry.getNode(config.nodeId);
    if (!identity) {
      identity = NodeKeyProvider.createNodeIdentity(
        config.nodeId,
        `NyayaVault ${config.nodeId}`,
        config.privateKeyPem,
      );
      this.nodeRegistry.registerNode(identity);
    }

    this.transport = new HttpNodeTransport({
      nodeId: config.nodeId,
      peerUrls: config.peerUrls,
      peerAllowlist: config.peerAllowlist,
      nodeRegistry: this.nodeRegistry,
      chainId: config.chainId,
      requestTimeoutMs: config.requestTimeoutMs,
    });

    const runtimeConfig: NodeRuntimeConfig = {
      nodeIdentity: identity,
      nodeRegistry: this.nodeRegistry,
      ledgerStore,
      transport: this.transport,
      chainId: config.chainId,
    };

    this.runtime = new NodeRuntime(runtimeConfig);
  }

  /**
   * Start physical node process: Rehydrate ledger and bind HTTP listener
   */
  async start(): Promise<void> {
    // 1. Execute fail-closed startup rehydration
    await this.runtime.start();

    // 2. Bind HTTP Listener for Node-to-Node RPC
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      });

      this.httpServer.on('error', (err) => {
        reject(err);
      });

      this.httpServer.listen(this.config.listenPort, this.config.listenHost, () => {
        resolve();
      });
    });
  }

  /**
   * Graceful node process shutdown
   */
  async stop(): Promise<void> {
    this.runtime.stop();
    if (this.httpServer) {
      if (typeof (this.httpServer as any).closeAllConnections === 'function') {
        (this.httpServer as any).closeAllConnections();
      }
      return new Promise((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }

  /**
   * Internal Node HTTP Router & Dispatcher
   */
  private async handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const url = req.url || '';
    const method = req.method || 'GET';

    // Route: GET /api/v1/node/health
    if (method === 'GET' && url.startsWith('/api/v1/node/health')) {
      const isReady = this.runtime.lifecycleState === 'READY';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          alive: true,
          ready: isReady,
          lifecycleState: this.runtime.lifecycleState,
          nodeId: this.config.nodeId,
        }),
      );
      return;
    }

    // Route: GET /api/v1/node/ready
    if (method === 'GET' && url.startsWith('/api/v1/node/ready')) {
      const isReady = this.runtime.lifecycleState === 'READY';
      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ready: isReady,
          lifecycleState: this.runtime.lifecycleState,
          nodeId: this.config.nodeId,
        }),
      );
      return;
    }

    // Route: GET /api/v1/node/status
    if (method === 'GET' && url.startsWith('/api/v1/node/status')) {
      const state = await this.runtime.getNodeState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    // Route: POST /api/v1/node/anchor-submission (Machine-to-machine application anchor entry)
    if (method === 'POST' && url.startsWith('/api/v1/node/anchor-submission')) {
      // Validate application auth secret if configured
      if (this.config.appServiceSecret) {
        const authHeader = req.headers['x-app-service-auth'] || req.headers['authorization'] || '';
        const token = (authHeader as string).replace(/^Bearer\s+/i, '').trim();
        if (token !== this.config.appServiceSecret) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'UNAUTHORIZED: Invalid application service credentials' }));
          return;
        }
      }

      if (this.runtime.lifecycleState !== 'READY') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'NODE_NOT_READY',
            reason: `Node '${this.config.nodeId}' is in '${this.runtime.lifecycleState}' state and cannot accept transactions`,
          }),
        );
        return;
      }

      const bodyStr = await this.readRequestBody(req);
      let payload: any;
      try {
        payload = JSON.parse(bodyStr);
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST: Invalid JSON payload' }));
        return;
      }

      const { params, policyId, timeoutMs } = payload;
      const resVal = await this.runtime.proposeAndCommitAnchor(params, policyId, timeoutMs);
      const statusCode = resVal.valid ? 200 : 400;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resVal));
      return;
    }

    // Route: POST /api/v1/node/message
    if (method === 'POST' && url.startsWith('/api/v1/node/message')) {
      const bodyStr = await this.readRequestBody(req);
      let envelope: NetworkMessageEnvelope;

      try {
        envelope = JSON.parse(bodyStr);
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST: Invalid JSON payload' }));
        return;
      }

      const result = await this.transport.handleIncomingHttpRequest(envelope);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 10 * 1024 * 1024) { // 10MB limit
          req.destroy();
          reject(new Error('PAYLOAD_TOO_LARGE'));
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
}
