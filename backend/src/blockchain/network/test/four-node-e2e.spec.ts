/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/test/four-node-e2e.spec.ts
 *
 * Four-Node E2E Consensus & Synchronization Baseline Verification
 */

import { FourNodeOrchestrator } from '../four-node-orchestrator';

describe('Four-Node E2E Baseline Suite', () => {
  let orchestrator: FourNodeOrchestrator;

  beforeEach(() => {
    orchestrator = new FourNodeOrchestrator({
      basePort: 7800,
      chainId: 'nyayavault-mainnet-e2e',
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stopAll();
    }
  });

  it('1. Initializes 4 distinct authority node servers cleanly', () => {
    expect(orchestrator.nodeServers.size).toBe(4);
    expect(orchestrator.nodeServers.has('POLICE_NODE')).toBe(true);
    expect(orchestrator.nodeServers.has('PROSECUTION_NODE')).toBe(true);
    expect(orchestrator.nodeServers.has('COURT_NODE')).toBe(true);
    expect(orchestrator.nodeServers.has('ADMIN_NODE')).toBe(true);
  });
});