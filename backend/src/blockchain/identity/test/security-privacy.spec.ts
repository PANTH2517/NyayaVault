/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/test/security-privacy.spec.ts
 */

import { InMemoryNodeRegistry } from '../in-memory-node-registry';

describe('Security & Private Key Isolation Verification', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry(true);
  });

  it('should not expose private keys in getPublicNode() response', () => {
    const pubNode = registry.getPublicNode('POLICE_NODE')!;
    expect(pubNode).toBeDefined();

    const jsonStr = JSON.stringify(pubNode);
    expect(jsonStr).not.toContain('PRIVATE KEY');
    expect((pubNode as any).privateKeyPem).toBeUndefined();
    expect((pubNode.activeKey as any).privateKeyPem).toBeUndefined();
  });

  it('should not expose private keys in listActiveNodes() list', () => {
    const activeList = registry.listActiveNodes();
    expect(activeList.length).toBe(4);

    for (const pubNode of activeList) {
      const jsonStr = JSON.stringify(pubNode);
      expect(jsonStr).not.toContain('PRIVATE KEY');
      expect((pubNode as any).privateKeyPem).toBeUndefined();
    }
  });
});
