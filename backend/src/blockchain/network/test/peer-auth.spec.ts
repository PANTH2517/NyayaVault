/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK TESTS
 * File: backend/src/blockchain/network/test/peer-auth.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { PeerAuthenticator } from '../peer-authenticator';
import { createNetworkEnvelope } from '../envelope';
import { generateSecp256k1KeyPair, hashSha256 } from '../../ledger/crypto';
import { signDomainPayload } from '../../identity/domain-signer';
import { NetworkMessageEnvelope } from '../types';

describe('Peer Authentication & Handshake Verification', () => {
  let registry: InMemoryNodeRegistry;

  beforeEach(() => {
    registry = new InMemoryNodeRegistry();
  });

  it('authenticates valid peer handshake', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');

    const handshake = authenticator.createHandshakeEnvelope();
    const result = authenticator.authenticateHandshake(handshake);

    expect(result.valid).toBe(true);
  });

  it('rejects unknown sender node ID', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');

    const handshake = authenticator.createHandshakeEnvelope();
    // Tamper senderNodeId to an unknown node
    (handshake as any).senderNodeId = 'UNKNOWN_HACKER_NODE';

    const result = authenticator.authenticateHandshake(handshake);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('UNREGISTERED_SENDER_NODE');
  });

  it('rejects wrong chain ID', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');

    const handshake = authenticator.createHandshakeEnvelope();
    handshake.chainId = 'wrong-chain-99';

    const result = authenticator.authenticateHandshake(handshake);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('CHAIN_ID_MISMATCH');
  });

  it('rejects handshake signed by un-registered key pair', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const fakeKeyPair = generateSecp256k1KeyPair();

    const fakeNode = {
      ...policeNode,
      keys: [
        {
          version: 1,
          status: 'ACTIVE' as const,
          publicKeyPem: fakeKeyPair.publicKeyPem,
          privateKeyPem: fakeKeyPair.privateKeyPem,
          fingerprint: hashSha256(fakeKeyPair.publicKeyPem),
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const handshake = createNetworkEnvelope({
      senderNode: fakeNode,
      messageType: 'HELLO_HANDSHAKE',
      chainId: 'nyayavault-mainnet-1',
      payload: {},
    });

    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');
    const result = authenticator.authenticateHandshake(handshake);

    expect(result.valid).toBe(false);
    expect(result.code).toBe('FINGERPRINT_MISMATCH');
  });

  it('rejects revoked node key in handshake', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const key = policeNode.keys[0];

    // Create envelope BEFORE revoking key
    const canonicalData = JSON.stringify({ test: 'revoked' });
    const signed = signDomainPayload(policeNode, 'NYAYAVAULT_CONSENSUS_V1', canonicalData);

    const revokedEnvelope: NetworkMessageEnvelope = {
      protocolVersion: '1.0',
      messageType: 'HELLO_HANDSHAKE',
      messageId: 'msg-revoked-1',
      chainId: 'nyayavault-mainnet-1',
      senderNodeId: 'POLICE_NODE',
      senderKeyVersion: 1,
      senderKeyFingerprint: key.fingerprint,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-1',
      payload: {},
      signatureHex: signed.signatureHex,
    };

    // Revoke key in registry
    registry.revokeNodeKey('POLICE_NODE', 1);

    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');
    const result = authenticator.authenticateHandshake(revokedEnvelope);

    expect(result.valid).toBe(false);
    expect(result.code).toBe('REVOKED_OR_INACTIVE_KEY');
  });

  it('rejects replayed handshake nonce / message ID', () => {
    const policeNode = registry.getNode('POLICE_NODE')!;
    const authenticator = new PeerAuthenticator(policeNode, registry, 'nyayavault-mainnet-1');

    const handshake = authenticator.createHandshakeEnvelope();

    // First attempt succeeds
    const firstResult = authenticator.authenticateHandshake(handshake);
    expect(firstResult.valid).toBe(true);

    // Replay attempt fails
    const secondResult = authenticator.authenticateHandshake(handshake);
    expect(secondResult.valid).toBe(false);
    expect(secondResult.code).toBe('REPLAYED_HANDSHAKE');
  });
});
