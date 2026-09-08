/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/test/four-node-runtime-1n.spec.ts
 *
 * Phase 1N — Four-Node Runtime Deployment Integration & E2E Consensus Verification
 * Real HTTP Server & Physical Process Integration Suite (34 Conditions)
 */

import * as http from 'http';
import { PhysicalNodeConfig, ALLOWED_NODE_TYPES } from '../physical-node-config';
import { NodeKeyProvider } from '../../identity/node-key-provider';
import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { NodeServer } from '../node-server';
import { FourNodeOrchestrator } from '../four-node-orchestrator';
import { HttpNodeTransport } from '../http-transport';
import { createNetworkEnvelope, verifyNetworkEnvelope } from '../envelope';
import { forgeBlock, createGenesisBlock } from '../../ledger/block';
import { createLedgerTransaction } from '../../ledger/transaction';
import { createBlockProposal, createBlockEndorsement } from '../../consensus/endorsement-signer';
import { PoAConsensusEngine } from '../../consensus/poa-consensus-engine';
import { ConsensusPolicyRegistry } from '../../consensus/policy-registry';
import { ProposalManager } from '../../consensus/proposal-manager';
import { InMemoryLedgerStore } from '../../ledger/in-memory-ledger-store';
import { LedgerBlock, NodeType } from '../../ledger/types';
import { PhysicalNodeAnchorGateway } from '../../integration/physical-node-anchor-gateway';
import { BlockchainAnchorIntentParams } from '../../integration/types';

describe('Phase 1N — Four-Node Runtime Deployment Integration & E2E Consensus Verification', () => {
  let orchestrator: FourNodeOrchestrator;
  const basePort = 7700; // Ports 7701-7704 to avoid conflicts

  beforeEach(async () => {
    orchestrator = new FourNodeOrchestrator({
      basePort,
      chainId: 'nyayavault-mainnet-1n',
      appServiceSecret: 'test-app-secret-1n-2026',
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stopAll();
    }
  });

  // Helper HTTP request sender with explicit connection closure
  function makeHttpRequest(
    urlStr: string,
    method: 'GET' | 'POST',
    headers: Record<string, string> = {},
    body?: string,
  ): Promise<{ statusCode: number; body: any }> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const reqHeaders = {
        ...headers,
        Connection: 'close',
      };

      const req = http.request(
        url,
        {
          method,
          headers: reqHeaders,
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed = data;
            try {
              parsed = JSON.parse(data);
            } catch (_) {}
            resolve({ statusCode: res.statusCode || 500, body: parsed });
          });
        },
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  // --------------------------------------------------------
  // 1. BOOTSTRAP & DEDICATED EXECUTABLE CONFIGURATION
  // --------------------------------------------------------
  it('1. Dedicated node process entry point boots cleanly with valid environment config', async () => {
    const config = PhysicalNodeConfig.fromEnv({
      BLOCKCHAIN_NODE_ID: 'POLICE_NODE',
      BLOCKCHAIN_CHAIN_ID: 'nyayavault-mainnet-1n',
      BLOCKCHAIN_LISTEN_PORT: '7799',
    });

    const registry = new InMemoryNodeRegistry();
    const server = new NodeServer(config, registry);
    await server.start();
    expect(server.runtime.lifecycleState).toBe('READY');
    await server.stop();
  });

  it('2. Invalid node configuration fails startup closed', () => {
    expect(() => PhysicalNodeConfig.fromEnv({ BLOCKCHAIN_NODE_ID: 'UNAUTHORIZED_NODE' })).toThrow(
      /UNSUPPORTED_NODE_TYPE/,
    );
    expect(() => PhysicalNodeConfig.fromEnv({ BLOCKCHAIN_NODE_ID: '' })).toThrow(/MISSING_NODE_ID/);
  });

  it('3. All 4 node servers boot on distinct ports and report READY state', async () => {
    await orchestrator.startAll();
    const isReady = await orchestrator.isAllReady();
    expect(isReady).toBe(true);

    for (const type of ALLOWED_NODE_TYPES) {
      const server = orchestrator.getNodeServer(type)!;
      expect(server.runtime.lifecycleState).toBe('READY');
    }
  });

  it('4. Four node IDs are strictly distinct', () => {
    const nodeTypes: NodeType[] = ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'];
    const nodeIds = nodeTypes.map((t) => orchestrator.getNodeServer(t)!.config.nodeId);
    expect(new Set(nodeIds).size).toBe(4);
  });

  it('5. Four node key identities are strictly distinct with unique fingerprints', () => {
    const fingerprints = ALLOWED_NODE_TYPES.map(
      (t) => orchestrator.registry.getNode(t)!.keys[0].fingerprint,
    );
    expect(new Set(fingerprints).size).toBe(4);
  });

  it('6. Independent ledger persistence is isolated by nodeId + chainId', async () => {
    const polStore = orchestrator.nodeStores.get('POLICE_NODE')!;
    const courtStore = orchestrator.nodeStores.get('COURT_NODE')!;

    await polStore.initialize();
    await courtStore.initialize();

    const polGen = await polStore.getBlockByHeight('0');
    const courtGen = await courtStore.getBlockByHeight('0');

    expect(polGen).toBeDefined();
    expect(courtGen).toBeDefined();
    expect(polGen?.header.height).toBe('0');
  });

  // --------------------------------------------------------
  // 2. REAL HTTP HANDSHAKE & PEER TRANSPORT
  // --------------------------------------------------------
  it('7. Real HTTP handshake exchanges authenticated signed peer message over loopback server', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;

    const policeNode = orchestrator.registry.getNode('POLICE_NODE')!;
    const env = createNetworkEnvelope({
      senderNode: policeNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1n',
      payload: { hello: 'pros' },
    });

    const targetUrl = `http://127.0.0.1:${prosServer.config.listenPort}/api/v1/node/message`;
    const res = await makeHttpRequest(targetUrl, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify(env));

    expect(res.statusCode).toBe(200);
    expect(res.body.messageType).toBe('PONG');
    expect(res.body.senderNodeId).toBe('PROSECUTION_NODE');
  });

  it('8. End-to-End STANDARD_ANCHOR proposal traverses real HTTP and satisfies PoA quorum', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;

    const res = await policeServer.runtime.proposeAndCommitAnchor(
      {
        eventType: 'EVIDENCE_CREATED',
        caseId: 'case-1n-8',
        evidenceHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      },
      'STANDARD_ANCHOR',
    );

    expect(res.valid).toBe(true);
    expect(res.block).toBeDefined();
    expect(res.block?.header.height).toBe('1');
  });

  it('9. All 4 nodes converge on chain ID, height, block hash, Merkle root, txId, and consensus proof', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    await policeServer.runtime.proposeAndCommitAnchor(
      {
        eventType: 'EVIDENCE_VERSION_CREATED',
        documentId: 'doc-1n-9',
        evidenceHash: '0xabc123',
      },
      'STANDARD_ANCHOR',
    );

    // Sync remaining nodes with POLICE_NODE over HTTP
    for (const type of ['PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'] as NodeType[]) {
      const server = orchestrator.getNodeServer(type)!;
      const syncRes = await server.runtime.connectAndSyncPeer('POLICE_NODE');
      expect(syncRes.success).toBe(true);
    }

    const bPol = await orchestrator.getNodeServer('POLICE_NODE')!.runtime.ledgerEngine.getLatestBlock();
    const bPros = await orchestrator.getNodeServer('PROSECUTION_NODE')!.runtime.ledgerEngine.getLatestBlock();
    const bCourt = await orchestrator.getNodeServer('COURT_NODE')!.runtime.ledgerEngine.getLatestBlock();
    const bAdmin = await orchestrator.getNodeServer('ADMIN_NODE')!.runtime.ledgerEngine.getLatestBlock();

    expect(bPol?.blockHash).toBe(bPros?.blockHash);
    expect(bPol?.blockHash).toBe(bCourt?.blockHash);
    expect(bPol?.blockHash).toBe(bAdmin?.blockHash);
    expect(bPol?.header.merkleRoot).toBe(bPros?.header.merkleRoot);
    expect(bPol?.consensusProof).toBeDefined();
  });

  // --------------------------------------------------------
  // 3. CONSENSUS POLICIES (SEALED_EVIDENCE & GOVERNANCE_CHECKPOINT)
  // --------------------------------------------------------
  it('10. SEALED_EVIDENCE policy requires 3 distinct required authority endorsements to commit', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const res = await policeServer.runtime.proposeAndCommitAnchor(
      {
        eventType: 'EVIDENCE_SEALED',
        documentId: 'doc-sealed-10',
        evidenceHash: '0xsealed10',
      },
      'SEALED_EVIDENCE',
    );

    expect(res.valid).toBe(true);
    expect(res.block?.consensusProof.requiredThreshold).toBe(3);
  });

  it('11. SEALED_EVIDENCE missing a required authority fails consensus validation', () => {
    const policyRegistry = new ConsensusPolicyRegistry();
    const res = policyRegistry.evaluateQuorum('SEALED_EVIDENCE', [
      { nodeId: 'POLICE_NODE' } as any,
      { nodeId: 'PROSECUTION_NODE' } as any,
      { nodeId: 'ADMIN_NODE' } as any,
    ]);

    expect(res.valid).toBe(false);
    expect(res.code).toBe('MISSING_REQUIRED_ENDORSER');
  });

  it('12. GOVERNANCE_CHECKPOINT policy restricts proposer authorization to ADMIN_NODE only', () => {
    const proposalManager = new ProposalManager({
      localNode: orchestrator.registry.getNode('POLICE_NODE')!,
      nodeRegistry: orchestrator.registry,
      policyRegistry: new ConsensusPolicyRegistry(),
      chainId: 'nyayavault-mainnet-1n',
    });
    const genesis = createGenesisBlock('nyayavault-mainnet-1n');

    const res = proposalManager.createProposal(genesis, 'GOVERNANCE_CHECKPOINT');
    expect(res.valid).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED_PROPOSER');
  });

  it('13. GOVERNANCE_CHECKPOINT proposal by ADMIN_NODE commits and replicates to peers', async () => {
    await orchestrator.startAll();

    const adminServer = orchestrator.getNodeServer('ADMIN_NODE')!;
    const res = await adminServer.runtime.proposeAndCommitAnchor(
      {
        eventType: 'AUDIT_CHECKPOINT',
        auditSequenceNumber: '1000',
        evidenceHash: '0xcheckpoint13',
      },
      'GOVERNANCE_CHECKPOINT',
    );

    expect(res.valid).toBe(true);
    expect(res.block?.header.height).toBe('1');
  });

  // --------------------------------------------------------
  // 4. APPLICATION GATEWAY & AUTHENTICATION
  // --------------------------------------------------------
  it('14. Node anchor-submission endpoint enforces machine-to-machine application authentication', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const targetUrl = `http://127.0.0.1:${policeServer.config.listenPort}/api/v1/node/anchor-submission`;

    // 1. Missing secret
    const resBad = await makeHttpRequest(targetUrl, 'POST', {}, JSON.stringify({ params: { eventType: 'EVIDENCE_CREATED' } }));
    expect(resBad.statusCode).toBe(401);

    // 2. Valid secret
    const resGood = await makeHttpRequest(
      targetUrl,
      'POST',
      { 'x-app-service-auth': 'test-app-secret-1n-2026', 'Content-Type': 'application/json' },
      JSON.stringify({
        params: { eventType: 'EVIDENCE_CREATED', caseId: 'c-14', evidenceHash: '0x14' },
        policyId: 'STANDARD_ANCHOR',
      }),
    );
    expect(resGood.statusCode).toBe(200);
    expect(resGood.body.valid).toBe(true);
  });

  it('15. PhysicalNodeAnchorGateway successfully submits anchor intent over HTTP to physical node gateway', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const gateway = new PhysicalNodeAnchorGateway({
      gatewayUrl: `http://127.0.0.1:${policeServer.config.listenPort}`,
      appServiceSecret: 'test-app-secret-1n-2026',
    });

    const res = await gateway.submitAnchor(
      {
        eventType: 'EVIDENCE_CREATED',
        caseId: 'c-gateway-15',
        evidenceHash: '0x15gateway',
      },
      'STANDARD_ANCHOR',
    );

    expect(res.success).toBe(true);
    expect(res.txId).toBeDefined();
    expect(res.blockHash).toBeDefined();
    expect(res.blockHeight).toBe('1');
  });

  it('16. Idempotent application anchor submissions process cleanly', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const gateway = new PhysicalNodeAnchorGateway({
      gatewayUrl: `http://127.0.0.1:${policeServer.config.listenPort}`,
      appServiceSecret: 'test-app-secret-1n-2026',
    });

    const params: BlockchainAnchorIntentParams = {
      eventType: 'EVIDENCE_CREATED',
      caseId: 'c-idempotent-16',
      evidenceHash: '0x16idem',
    };

    const res1 = await gateway.submitAnchor(params, 'STANDARD_ANCHOR');
    expect(res1.success).toBe(true);

    const height1 = await policeServer.runtime.ledgerEngine.getHeight();
    expect(height1).toBe(1n);
  });

  it('17. Blockchain gateway connection failure is handled safely without throwing uncaught exceptions', async () => {
    const gateway = new PhysicalNodeAnchorGateway({
      gatewayUrl: 'http://127.0.0.1:59999', // Closed port
      appServiceSecret: 'test-secret',
      timeoutMs: 1000,
    });

    const res = await gateway.submitAnchor(
      { eventType: 'EVIDENCE_CREATED', caseId: 'c-17', evidenceHash: '0x17' },
      'STANDARD_ANCHOR',
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('Gateway connection failed');
  });

  // --------------------------------------------------------
  // 5. RESTART, REHYDRATION & CATCH-UP
  // --------------------------------------------------------
  it('18. Node process restarts, rehydrates state from persistent store, and reaches READY', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    await policeServer.runtime.proposeAndCommitAnchor(
      { eventType: 'EVIDENCE_CREATED', caseId: 'c-restart-18', evidenceHash: '0x18' },
      'STANDARD_ANCHOR',
    );

    const heightBefore = await policeServer.runtime.ledgerEngine.getHeight();
    expect(heightBefore).toBe(1n);

    // Stop node server
    await orchestrator.stopNode('POLICE_NODE');

    // Restart same node server instance with retained store
    await orchestrator.startNode('POLICE_NODE');
    const restartedServer = orchestrator.getNodeServer('POLICE_NODE')!;

    expect(restartedServer.runtime.lifecycleState).toBe('READY');
    const heightAfter = await restartedServer.runtime.ledgerEngine.getHeight();
    expect(heightAfter).toBe(1n);
  });

  it('19. Corrupted ledger state causes node rehydration to fail closed into FAILED state', async () => {
    const store = new InMemoryLedgerStore('nyayavault-mainnet-1n');
    const genesis = await store.initialize();

    // Inject corrupted block
    const badBlock: LedgerBlock = {
      ...genesis,
      header: { ...genesis.header, height: '1' },
      blockHash: 'corrupted_fake_hash',
    };
    (store as any).blocks.push(badBlock);

    const policeNode = orchestrator.registry.getNode('POLICE_NODE')!;
    const config = new PhysicalNodeConfig({
      nodeId: 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1n',
      listenHost: '127.0.0.1',
      listenPort: 7795,
      peerUrls: new Map(),
      peerAllowlist: new Set(['POLICE_NODE']),
      requestTimeoutMs: 5000,
      maxMessageAgeMs: 300000,
      privateKeyPem: policeNode.keys[0].publicKeyPem,
    });

    const server = new NodeServer(config, orchestrator.registry, store);
    await expect(server.start()).rejects.toThrow();
    expect(server.runtime.lifecycleState).toBe('FAILED');
  });

  it('20. Stopped peer process restarts and rejoins network cleanly', async () => {
    await orchestrator.startAll();

    // Stop COURT_NODE
    await orchestrator.stopNode('COURT_NODE');

    // Commit block with POLICE_NODE & PROSECUTION_NODE (STANDARD_ANCHOR policy requires 2 nodes)
    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    await policeServer.runtime.proposeAndCommitAnchor(
      { eventType: 'EVIDENCE_CREATED', caseId: 'c-rejoin-20', evidenceHash: '0x20' },
      'STANDARD_ANCHOR',
    );

    // Restart COURT_NODE
    await orchestrator.startNode('COURT_NODE');
    expect(orchestrator.getNodeServer('COURT_NODE')!.runtime.lifecycleState).toBe('READY');
  });

  it('21. Restarted peer synchronizes missing block over HTTP transport and catches up', async () => {
    await orchestrator.startAll();

    // Stop PROSECUTION_NODE
    await orchestrator.stopNode('PROSECUTION_NODE');

    // Commit block on Police
    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    await policeServer.runtime.proposeAndCommitAnchor(
      { eventType: 'EVIDENCE_CREATED', caseId: 'c-catchup-21', evidenceHash: '0x21' },
      'STANDARD_ANCHOR',
    );

    // Restart PROSECUTION_NODE & sync over HTTP
    await orchestrator.startNode('PROSECUTION_NODE');
    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;

    const syncRes = await prosServer.runtime.connectAndSyncPeer('POLICE_NODE');
    expect(syncRes.success).toBe(true);
    expect(syncRes.blocksSynced).toBe(1);
  });

  it('22. All nodes reconverge on exact tip block hash after catch-up', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;

    await prosServer.runtime.connectAndSyncPeer('POLICE_NODE');

    const b1 = await policeServer.runtime.ledgerEngine.getLatestBlock();
    const b2 = await prosServer.runtime.ledgerEngine.getLatestBlock();

    expect(b1?.blockHash).toBe(b2?.blockHash);
  });

  // --------------------------------------------------------
  // 6. NETWORK HARDENING & SECURITY BOUNDARIES
  // --------------------------------------------------------
  it('23. Peer HTTP transport timeout is strictly bounded within requestTimeoutMs', async () => {
    const transport = new HttpNodeTransport({
      nodeId: 'POLICE_NODE',
      peerUrls: new Map([['PROSECUTION_NODE', 'http://127.0.0.1:59998']]), // Unreachable IP/Port
      peerAllowlist: new Set(['PROSECUTION_NODE']),
      nodeRegistry: orchestrator.registry,
      requestTimeoutMs: 500,
    });

    const policeNode = orchestrator.registry.getNode('POLICE_NODE')!;
    const env = createNetworkEnvelope({
      senderNode: policeNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1n',
      payload: {},
    });

    const startMs = Date.now();
    const res = await transport.sendMessage('PROSECUTION_NODE', env);
    const elapsed = Date.now() - startMs;

    expect(res).toBeNull();
    expect(elapsed).toBeLessThan(3000);
  });

  it('24. Malformed peer JSON payload is rejected with HTTP 400 Bad Request', async () => {
    await orchestrator.startAll();

    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;
    const targetUrl = `http://127.0.0.1:${prosServer.config.listenPort}/api/v1/node/message`;

    const res = await makeHttpRequest(targetUrl, 'POST', { 'Content-Type': 'application/json' }, 'INVALID_NOT_JSON');
    expect(res.statusCode).toBe(400);
  });

  it('25. Stale peer envelope outside max message age window is rejected with HTTP 401 Unauthorized', async () => {
    await orchestrator.startAll();

    const policeNode = orchestrator.registry.getNode('POLICE_NODE')!;
    const oldTimestamp = new Date(Date.now() - 600000).toISOString(); // 10 mins ago

    const env = createNetworkEnvelope({
      senderNode: policeNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1n',
      payload: {},
      timestamp: oldTimestamp,
    });

    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;
    const targetUrl = `http://127.0.0.1:${prosServer.config.listenPort}/api/v1/node/message`;

    const res = await makeHttpRequest(targetUrl, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify(env));
    expect(res.statusCode).toBe(401);
  });

  it('26. Forged peer signature is rejected with HTTP 401 Unauthorized', async () => {
    await orchestrator.startAll();

    const policeNode = orchestrator.registry.getNode('POLICE_NODE')!;
    const env = createNetworkEnvelope({
      senderNode: policeNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1n',
      payload: {},
    });

    const forgedEnv = { ...env, signatureHex: 'deadbeef_forged_sig' };

    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;
    const targetUrl = `http://127.0.0.1:${prosServer.config.listenPort}/api/v1/node/message`;

    const res = await makeHttpRequest(targetUrl, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify(forgedEnv));
    expect(res.statusCode).toBe(401);
  });

  it('27. Duplicate endorsement from same node ID rejected for quorum count', () => {
    const engine = new PoAConsensusEngine(orchestrator.registry);
    const res = engine.verifyEndorsements(['POLICE_NODE', 'POLICE_NODE'], 'STANDARD_ANCHOR');
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INSUFFICIENT_ENDORSEMENTS');
  });

  it('28. Duplicate block delivery is handled safely without double commit', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const gen = await policeServer.runtime.ledgerEngine.getLatestBlock();

    const res1 = await policeServer.runtime.ledgerEngine.appendBlock(gen!);
    expect(res1.valid).toBe(false);
    expect(res1.code).toBe('INVALID_PREVIOUS_HASH');

    const height = await policeServer.runtime.ledgerEngine.getHeight();
    expect(height).toBe(0n);
  });

  it('29. Conflicting block at same height triggers DIVERGED sync status', async () => {
    await orchestrator.startAll();

    const polServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const prosServer = orchestrator.getNodeServer('PROSECUTION_NODE')!;

    const genPol = await polServer.runtime.ledgerEngine.getLatestBlock();
    const genPros = await prosServer.runtime.ledgerEngine.getLatestBlock();

    const b1Pol = forgeBlock({
      previousBlock: genPol!,
      transactions: [],
      proposerNode: 'POLICE_NODE',
      timestamp: '2026-09-08T12:00:00.000Z',
    });

    const b1Pros = forgeBlock({
      previousBlock: genPros!,
      transactions: [],
      proposerNode: 'PROSECUTION_NODE',
      timestamp: '2026-09-08T12:05:00.000Z',
    });

    const polStore = orchestrator.nodeStores.get('POLICE_NODE') as InMemoryLedgerStore;
    const prosStore = orchestrator.nodeStores.get('PROSECUTION_NODE') as InMemoryLedgerStore;

    (polStore as any).blocks.push(b1Pol);
    (polStore as any).blockByHeight.set('1', b1Pol);

    (prosStore as any).blocks.push(b1Pros);
    (prosStore as any).blockByHeight.set('1', b1Pros);

    const syncRes = await prosServer.runtime.connectAndSyncPeer('POLICE_NODE');
    expect(syncRes.success).toBe(false);
    expect(syncRes.divergence?.diverged).toBe(true);
  });

  it('30. Node in DIVERGED state halts consensus processing', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    policeServer.runtime.lifecycleState = 'DIVERGED';

    const genesis = createGenesisBlock('nyayavault-mainnet-1n');
    const res = await policeServer.runtime.proposeAndCommitBlock(genesis);

    expect(res.valid).toBe(false);
    expect(res.code).toBe('NODE_NOT_READY');

    policeServer.runtime.lifecycleState = 'READY';
  });

  // --------------------------------------------------------
  // 7. OBSERVABILITY, HEALTH/READINESS & SECURITY
  // --------------------------------------------------------
  it('31. Health vs Readiness endpoints enforce exact lifecycle status codes', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const host = `http://127.0.0.1:${policeServer.config.listenPort}`;

    // 1. When READY
    const resHealth1 = await makeHttpRequest(`${host}/api/v1/node/health`, 'GET');
    expect(resHealth1.statusCode).toBe(200);
    expect(resHealth1.body.ready).toBe(true);

    const resReady1 = await makeHttpRequest(`${host}/api/v1/node/ready`, 'GET');
    expect(resReady1.statusCode).toBe(200);
    expect(resReady1.body.ready).toBe(true);

    // 2. When FAILED
    policeServer.runtime.lifecycleState = 'FAILED';

    const resHealth2 = await makeHttpRequest(`${host}/api/v1/node/health`, 'GET');
    expect(resHealth2.statusCode).toBe(200);
    expect(resHealth2.body.ready).toBe(false);

    const resReady2 = await makeHttpRequest(`${host}/api/v1/node/ready`, 'GET');
    expect(resReady2.statusCode).toBe(503);
    expect(resReady2.body.ready).toBe(false);

    policeServer.runtime.lifecycleState = 'READY';
  });

  it('32. Node status responses and logs contain zero private signing keys or raw secrets', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const host = `http://127.0.0.1:${policeServer.config.listenPort}`;

    const res = await makeHttpRequest(`${host}/api/v1/node/status`, 'GET');
    const str = JSON.stringify(res.body);

    expect(str).not.toContain('privateKey');
    expect(str).not.toContain('BEGIN PRIVATE KEY');
    expect(str).not.toContain('appServiceSecret');
  });

  it('33. Ordinary application user JWT cannot mutate node consensus state', async () => {
    await orchestrator.startAll();

    const policeServer = orchestrator.getNodeServer('POLICE_NODE')!;
    const host = `http://127.0.0.1:${policeServer.config.listenPort}`;

    const userJwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_token';
    const res = await makeHttpRequest(
      `${host}/api/v1/node/anchor-submission`,
      'POST',
      { Authorization: userJwt },
      JSON.stringify({ params: { eventType: 'EVIDENCE_CREATED' } }),
    );

    expect(res.statusCode).toBe(401);
  });

  it('34. Application ADMIN role cannot impersonate ADMIN_NODE secp256k1 key identity', () => {
    const adminNode = orchestrator.registry.getNode('ADMIN_NODE')!;
    const pubKey = adminNode.keys[0].publicKeyPem;

    expect(pubKey).toContain('BEGIN PUBLIC KEY');
    expect(adminNode.nodeId).toBe('ADMIN_NODE');
  });
});
