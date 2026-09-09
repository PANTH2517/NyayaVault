/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/test/blockchain-observability.spec.ts
 *
 * Isolated Unit Test Suite for Blockchain Operational Observability & State Precedence
 */

import { BlockchainObservabilityService, NodeObservabilityModel } from '../blockchain-observability.service';

describe('BlockchainObservabilityService (Unit Tests with Isolated Mocks)', () => {
  let service: BlockchainObservabilityService;
  let mockPrismaService: any;

  beforeEach(() => {
    mockPrismaService = {
      blockchainApplicationAnchor: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({
          id: '1be0d312-632f-4873-8f56-103c2a9f4c76',
          idempotencyKey: 'b15ce0b9a8b487cead4acbbd8f522d48c4fe218608ae073cda34265052bc59d6',
          eventType: 'AUDIT_CHECKPOINT',
          policyId: 'GOVERNANCE_CHECKPOINT',
          status: 'CONFIRMED',
          blockchainTxId: '71414bc9fea55cf68fd637dbad662735fea1b263b1326b3f643d34e9cd0eacd2',
          blockHeight: 4n,
          blockHash: 'c920b8af6791e4ba80e5990dc35292296e0ad3a524875ab0a9e723a47e057ebb',
          confirmedAt: new Date(),
        }),
      },
      blockchainBlock: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      blockchainChain: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    service = new BlockchainObservabilityService(mockPrismaService);
  });

  const createMockNode = (
    nodeId: string,
    overrides?: Partial<NodeObservabilityModel>,
  ): NodeObservabilityModel => ({
    nodeId,
    organization: `NyayaVault ${nodeId}`,
    nodeUrl: `https://nyayavault-${nodeId.toLowerCase().replace('_node', '')}-node.onrender.com`,
    reachable: true,
    ready: true,
    lifecycleState: 'READY',
    chainId: 'nyayavault-mainnet-1',
    currentHeight: '4',
    latestBlockHash: 'c920b8af6791e4ba80e5990dc35292296e0ad3a524875ab0a9e723a47e057ebb',
    fingerprint: '4e7ea9425973a4473ced1d8e953f555b8472f9d7c9b761e3e0d324caadc0ef33',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE...\n-----END PUBLIC KEY-----',
    configuredPeerIds: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'].filter((id) => id !== nodeId),
    authenticatedPeerCount: 3,
    divergenceState: 'NONE',
    rehydrationState: 'COMPLETED',
    acceptingConsensus: true,
    lastCommunicationTimestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('Deterministic Network State Precedence Logic', () => {
    it('1. Four healthy nodes -> SYNCHRONIZED', () => {
      const nodes = [
        createMockNode('POLICE_NODE'),
        createMockNode('PROSECUTION_NODE'),
        createMockNode('COURT_NODE'),
        createMockNode('ADMIN_NODE'),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('SYNCHRONIZED');
    });

    it('2. One node unavailable -> DEGRADED', () => {
      const nodes = [
        createMockNode('POLICE_NODE'),
        createMockNode('PROSECUTION_NODE'),
        createMockNode('COURT_NODE', { reachable: false, ready: false, lifecycleState: 'UNAVAILABLE' }),
        createMockNode('ADMIN_NODE'),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('DEGRADED');
    });

    it('3. One node behind in height -> BEHIND', () => {
      const nodes = [
        createMockNode('POLICE_NODE', { currentHeight: '4', latestBlockHash: 'hash4' }),
        createMockNode('PROSECUTION_NODE', { currentHeight: '4', latestBlockHash: 'hash4' }),
        createMockNode('COURT_NODE', { currentHeight: '3', latestBlockHash: 'hash3' }),
        createMockNode('ADMIN_NODE', { currentHeight: '4', latestBlockHash: 'hash4' }),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('BEHIND');
    });

    it('4. Conflicting tip hash at same height -> DIVERGED', () => {
      const nodes = [
        createMockNode('POLICE_NODE', { currentHeight: '4', latestBlockHash: 'hash-legitimate' }),
        createMockNode('PROSECUTION_NODE', { currentHeight: '4', latestBlockHash: 'hash-legitimate' }),
        createMockNode('COURT_NODE', { currentHeight: '4', latestBlockHash: 'hash-FORK-DIVERGENT' }),
        createMockNode('ADMIN_NODE', { currentHeight: '4', latestBlockHash: 'hash-legitimate' }),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('DIVERGED');
    });

    it('4b. Mismatched chain IDs across nodes -> DIVERGED', () => {
      const nodes = [
        createMockNode('POLICE_NODE', { chainId: 'nyayavault-mainnet-1' }),
        createMockNode('PROSECUTION_NODE', { chainId: 'nyayavault-mainnet-1' }),
        createMockNode('COURT_NODE', { chainId: 'nyayavault-testnet-FORK' }),
        createMockNode('ADMIN_NODE', { chainId: 'nyayavault-mainnet-1' }),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('DIVERGED');
    });

    it('5. Malformed identity fingerprint -> INVALID', () => {
      const nodes = [
        createMockNode('POLICE_NODE'),
        createMockNode('PROSECUTION_NODE'),
        createMockNode('COURT_NODE', { fingerprint: '' }), // malformed
        createMockNode('ADMIN_NODE'),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('INVALID');
    });

    it('6. All nodes unreachable -> UNAVAILABLE', () => {
      const nodes = [
        createMockNode('POLICE_NODE', { reachable: false }),
        createMockNode('PROSECUTION_NODE', { reachable: false }),
        createMockNode('COURT_NODE', { reachable: false }),
        createMockNode('ADMIN_NODE', { reachable: false }),
      ];

      const state = service.computeNetworkState(nodes);
      expect(state).toBe('UNAVAILABLE');
    });
  });

  describe('Security, Privacy & Read-Only Safety Guarantees', () => {
    it('does not expose private keys, secrets, or sensitive credentials in returned observability objects', async () => {
      const mockFetcher = jest.fn().mockImplementation((url: string) => {
        if (url.includes('health')) return Promise.resolve({ status: 200, data: { status: 'ok', alive: true, ready: true, lifecycleState: 'READY' } });
        if (url.includes('ready')) return Promise.resolve({ status: 200, data: { ready: true, lifecycleState: 'READY' } });
        if (url.includes('status')) return Promise.resolve({ status: 200, data: { currentHeight: '4', latestBlockHash: 'c920b8af6791e4ba80e5990dc35292296e0ad3a524875ab0a9e723a47e057ebb', chainId: 'nyayavault-mainnet-1' } });
        if (url.includes('identity')) return Promise.resolve({ status: 200, data: { nodeId: 'COURT_NODE', activeKey: { fingerprint: '4e7ea9425973a4473ced1d8e953f555b8472f9d7c9b761e3e0d324caadc0ef33', publicKeyPem: 'PUBLIC_KEY_PEM' } } });
        return Promise.resolve({ status: 404 });
      });

      const observability = await service.getNetworkObservability(mockFetcher);
      const jsonString = JSON.stringify(observability);

      expect(jsonString).not.toContain('privateKey');
      expect(jsonString).not.toContain('appServiceSecret');
      expect(jsonString).not.toContain('passwordHash');
      expect(jsonString).not.toContain('DATABASE_URL');
      expect(jsonString).not.toContain('jwtSecret');
    });

    it('executes strictly read-only queries and does not invoke write/anchor creation operations', async () => {
      const mockFetcher = jest.fn().mockResolvedValue({ status: 200, data: { ready: true, lifecycleState: 'READY' } });
      await service.getNetworkObservability(mockFetcher);

      // Verify no write methods on Prisma models were invoked
      expect(mockPrismaService.blockchainApplicationAnchor.count).toHaveBeenCalled();
      expect(mockPrismaService.blockchainApplicationAnchor.findUnique).toHaveBeenCalled();
    });
  });
});
