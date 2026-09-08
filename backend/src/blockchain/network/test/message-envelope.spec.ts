/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/message-envelope.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { createNetworkEnvelope, verifyNetworkEnvelope, MAX_MESSAGE_AGE_MS } from '../envelope';

describe('Network Message Envelope & Cryptographic Integrity', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
  });

  it('creates and verifies valid network message envelope', () => {
    const courtNode = registry.getNode('COURT_NODE')!;
    const envelope = createNetworkEnvelope({
      senderNode: courtNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1',
      payload: { ping: 'hello' },
    });

    const result = verifyNetworkEnvelope(envelope, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(true);
  });

  it('rejects envelope if payload is altered after signing', () => {
    const prosecutionNode = registry.getNode('PROSECUTION_NODE')!;
    const envelope = createNetworkEnvelope({
      senderNode: prosecutionNode,
      messageType: 'BLOCK_REQUEST',
      chainId: 'nyayavault-mainnet-1',
      payload: { height: '5' },
    });

    // Tamper payload
    envelope.payload = { height: '9999' };

    const result = verifyNetworkEnvelope(envelope, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_ENVELOPE_SIGNATURE');
  });

  it('rejects envelope if signature hex is corrupted', () => {
    const adminNode = registry.getNode('ADMIN_NODE')!;
    const envelope = createNetworkEnvelope({
      senderNode: adminNode,
      messageType: 'STATUS_REQUEST',
      chainId: 'nyayavault-mainnet-1',
      payload: {},
    });

    // Corrupt signature
    envelope.signatureHex = '00'.repeat(64);

    const result = verifyNetworkEnvelope(envelope, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_ENVELOPE_SIGNATURE');
  });

  it('rejects stale or future expired envelope timestamps', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const staleTimestamp = new Date(Date.now() - MAX_MESSAGE_AGE_MS - 10000).toISOString();

    const envelope = createNetworkEnvelope({
      senderNode: policeNode,
      messageType: 'PING',
      chainId: 'nyayavault-mainnet-1',
      payload: {},
      timestamp: staleTimestamp,
    });

    const result = verifyNetworkEnvelope(envelope, registry, 'nyayavault-mainnet-1');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('MESSAGE_EXPIRED_OR_STALE');
  });
});
