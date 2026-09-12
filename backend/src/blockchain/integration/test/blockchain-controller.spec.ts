/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/test/blockchain-controller.spec.ts
 *
 * Unit Tests for BlockchainController Status Endpoint Role-Scoping & Security
 */

import { BlockchainController } from '../blockchain.controller';
import { RoleName } from '@prisma/client';

describe('BlockchainController (Status Role-Scoping & Security Tests)', () => {
  let controller: BlockchainController;
  let mockPrisma: any;
  let mockIntegrationService: any;
  let mockObservabilityService: any;

  beforeEach(() => {
    mockPrisma = {};
    mockIntegrationService = {};
    mockObservabilityService = {
      getNetworkObservability: jest.fn().mockResolvedValue({
        networkState: 'SYNCHRONIZED',
        chainConsistency: 'CONSISTENT',
        consensusAgreed: true,
        timestamp: '2026-09-13T00:00:00.000Z',
        chainId: 'nyayavault-mainnet-1',
        nodes: [
          {
            nodeId: 'POLICE_NODE',
            organization: 'NyayaVault Police Node',
            reachable: true,
            ready: true,
            lifecycleState: 'READY',
            currentHeight: '4',
            latestBlockHash: 'c920b8af6791e4ba80e5990dc35292296e0ad3a524875ab0a9e723a47e057ebb',
          },
        ],
        latestBlock: {
          blockHeight: '4',
          blockHash: 'c920b8af6791e4ba80e5990dc35292296e0ad3a524875ab0a9e723a47e057ebb',
        },
        knownProductionAnchor: null,
        anchorSummary: { total: 0, confirmed: 0, pending: 0, failed: 0 },
      }),
    };

    controller = new BlockchainController(
      mockPrisma,
      mockIntegrationService,
      mockObservabilityService,
    );
  });

  it('returns full network observability for ADMIN users including networkState', async () => {
    const userPayload: any = { userId: 'admin-uuid', role: RoleName.ADMIN };
    const res = await controller.getStatus(userPayload);

    expect(res).toBeDefined();
    expect(res.networkState).toBe('SYNCHRONIZED');
    expect(res.nodes).toHaveLength(1);
    expect(mockObservabilityService.getNetworkObservability).toHaveBeenCalled();
  });

  it('returns full network observability for non-ADMIN users (INVESTIGATING_OFFICER, SUPERVISOR, PROSECUTOR) including networkState', async () => {
    const roles = [
      RoleName.INVESTIGATING_OFFICER,
      RoleName.SUPERVISOR,
      RoleName.PROSECUTOR,
    ];

    for (const role of roles) {
      const userPayload: any = { userId: `user-${role}`, role };
      const res = await controller.getStatus(userPayload);

      expect(res).toBeDefined();
      expect(res.networkState).toBe('SYNCHRONIZED');
      expect(res.nodes).toBeDefined();
      expect(res.anchorSummary).toBeDefined();
    }
  });

  it('does not leak private keys, passwords, or secrets in status payload', async () => {
    const userPayload: any = { userId: 'io-uuid', role: RoleName.INVESTIGATING_OFFICER };
    const res = await controller.getStatus(userPayload);
    const jsonStr = JSON.stringify(res);

    expect(jsonStr).not.toContain('privateKey');
    expect(jsonStr).not.toContain('passwordHash');
    expect(jsonStr).not.toContain('jwtSecret');
    expect(jsonStr).not.toContain('DATABASE_URL');
  });
});
