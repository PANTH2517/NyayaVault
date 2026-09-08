/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS TESTS
 * File: backend/src/blockchain/consensus/test/network-consensus.spec.ts
 */

import { InMemoryNodeRegistry } from '../../identity/in-memory-node-registry';
import { forgeBlock } from '../../ledger/block';
import { createLedgerTransaction, signTransaction } from '../../ledger/transaction';
import { LedgerNodeIdentity } from '../../ledger/types';
import { createNetworkEnvelope } from '../../network/envelope';
import { InMemoryNodeTransportDispatcher } from '../../network/in-memory-transport';
import { NodeRuntime } from '../../network/node-runtime';
import { createBlockProposal } from '../endorsement-signer';

describe('Consensus Network Authentication & Message Protocol Engine', () => {
  let registry: InMemoryNodeRegistry;
  let transport: InMemoryNodeTransportDispatcher;

  let policeNode: NodeRuntime;
  let prosecutionNode: NodeRuntime;

  beforeEach(async () => {
    registry = new InMemoryNodeRegistry();
    transport = new InMemoryNodeTransportDispatcher();

    policeNode = new NodeRuntime({
      nodeIdentity: registry.getNode('POLICE_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    prosecutionNode = new NodeRuntime({
      nodeIdentity: registry.getNode('PROSECUTION_NODE')!,
      nodeRegistry: registry,
      transport,
    });

    await policeNode.start();
    await prosecutionNode.start();
  });

  afterEach(() => {
    policeNode.stop();
    prosecutionNode.stop();
  });

  it('accepts authenticated BLOCK_PROPOSAL from authorized peer and returns valid BLOCK_ENDORSEMENT envelope', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const polGen = await policeNode.ledgerEngine.getLatestBlock();

    const unsignedTx = createLedgerTransaction({
      chainId: 'nyayavault-mainnet-1',
      txType: 'EVIDENCE_ANCHOR',
      originatingNode: 'POLICE_NODE',
      nonce: 1,
      payload: { caseId: 'CASE-NET-1' },
    });

    const policeSigner: LedgerNodeIdentity = {
      nodeId: 'POLICE_NODE',
      name: 'Police Node',
      publicKeyPem: policeIdentity.keys[0].publicKeyPem,
      privateKeyPem: policeIdentity.privateKeysByVersion.get(1)!,
    };

    const tx = signTransaction(unsignedTx, policeSigner);
    const block1 = forgeBlock({ previousBlock: polGen!, transactions: [tx], proposerNode: 'POLICE_NODE' });

    const proposal = createBlockProposal({
      proposerNode: policeIdentity,
      block: block1,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const proposalEnvelope = createNetworkEnvelope({
      senderNode: policeIdentity,
      messageType: 'BLOCK_PROPOSAL',
      chainId: 'nyayavault-mainnet-1',
      payload: { proposal },
    });

    // Send proposal envelope to PROSECUTION_NODE
    const response = await transport.sendMessage('PROSECUTION_NODE', proposalEnvelope);

    expect(response).not.toBeNull();
    expect(response?.messageType).toBe('BLOCK_ENDORSEMENT');
    expect(response?.senderNodeId).toBe('PROSECUTION_NODE');
  });

  it('rejects unauthenticated or signature-tampered BLOCK_PROPOSAL envelope', async () => {
    const policeIdentity = registry.getNode('POLICE_NODE')!;
    const polGen = await policeNode.ledgerEngine.getLatestBlock();

    const proposal = createBlockProposal({
      proposerNode: policeIdentity,
      block: polGen!,
      policyId: 'STANDARD_ANCHOR',
      chainId: 'nyayavault-mainnet-1',
    });

    const proposalEnvelope = createNetworkEnvelope({
      senderNode: policeIdentity,
      messageType: 'BLOCK_PROPOSAL',
      chainId: 'nyayavault-mainnet-1',
      payload: { proposal },
    });

    // Tamper envelope signature
    proposalEnvelope.signatureHex = '00'.repeat(64);

    const response = await transport.sendMessage('PROSECUTION_NODE', proposalEnvelope);

    // NodeRuntime returns null for tampered network envelopes
    expect(response).toBeNull();
  });
});
