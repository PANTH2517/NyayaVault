/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN CONSENSUS
 * File: backend/src/blockchain/consensus/consensus-network-handler.ts
 *
 * Consensus Network RPC Messaging, Endorsement Collection & Commit Broadcast Coordinator
 */

import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity, NodeType } from '../identity/types';
import { LedgerBlock, VerificationResult } from '../ledger/types';
import { LedgerEngine } from '../ledger/ledger-engine';
import { createNetworkEnvelope, verifyNetworkEnvelope } from '../network/envelope';
import { INodeTransport } from '../network/transport.interface';
import { PeerRegistry } from '../network/peer-registry';
import {
  BlockEndorsementPayload,
  BlockProposalPayload,
  ConsensusCommitPayload,
  ConsensusRejectPayload,
  NetworkMessageEnvelope,
} from '../network/types';
import { ProposalManager } from './proposal-manager';
import { PoAConsensusEngine } from './poa-consensus-engine';
import { BlockEndorsement, BlockProposal, PoAConsensusProof } from './types';

export interface ConsensusNetworkHandlerConfig {
  localNode: NodeIdentity;
  nodeRegistry: INodeRegistry;
  ledgerEngine: LedgerEngine;
  peerRegistry: PeerRegistry;
  transport: INodeTransport;
  proposalManager: ProposalManager;
  consensusEngine: PoAConsensusEngine;
  chainId: string;
}

export class ConsensusNetworkHandler {
  private readonly localNode: NodeIdentity;
  private readonly nodeRegistry: INodeRegistry;
  private readonly ledgerEngine: LedgerEngine;
  private readonly peerRegistry: PeerRegistry;
  private readonly transport: INodeTransport;
  private readonly proposalManager: ProposalManager;
  private readonly consensusEngine: PoAConsensusEngine;
  private readonly chainId: string;

  constructor(config: ConsensusNetworkHandlerConfig) {
    this.localNode = config.localNode;
    this.nodeRegistry = config.nodeRegistry;
    this.ledgerEngine = config.ledgerEngine;
    this.peerRegistry = config.peerRegistry;
    this.transport = config.transport;
    this.proposalManager = config.proposalManager;
    this.consensusEngine = config.consensusEngine;
    this.chainId = config.chainId;
  }

  /**
   * Propose a block, collect network endorsements, commit, and broadcast commit announcement
   */
  async proposeAndCommitBlock(
    block: LedgerBlock,
    policyId = 'STANDARD_ANCHOR',
    timeoutMs = 60000,
  ): Promise<VerificationResult & { proof?: PoAConsensusProof; block?: LedgerBlock }> {
    // 1. Create local proposal
    const propRes = this.proposalManager.createProposal(block, policyId, timeoutMs);
    if (!propRes.valid || !propRes.proposal) {
      return propRes;
    }

    const proposal = propRes.proposal;

    // Add proposer's own endorsement if eligible
    const selfEndorsementRes = this.proposalManager.createEndorsement(proposal.proposalId);
    if (selfEndorsementRes.valid && selfEndorsementRes.endorsement) {
      this.proposalManager.addEndorsement(selfEndorsementRes.endorsement);
    }

    // Check if self-endorsement already reached quorum (e.g. 1-of-1 test scenarios)
    const currentRec = this.proposalManager.getProposalRecord(proposal.proposalId);
    if (currentRec?.state === 'COMMITTED' && currentRec.proof) {

      const appendRes = await this.ledgerEngine.appendBlock(proposal.block);
      if (!appendRes.valid) return appendRes;

      await this.broadcastCommitAnnouncement(proposal.block, currentRec.proof);
      return { valid: true, proof: currentRec.proof, block: proposal.block };
    }

    // 2. Broadcast BLOCK_PROPOSAL to all enabled peers
    const peers = this.peerRegistry.listPeers().filter((p) => p.isEnabled);

    for (const peer of peers) {
      const proposalEnvelope = createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'BLOCK_PROPOSAL',
        chainId: this.chainId,
        payload: { proposal } as BlockProposalPayload,
      });

      const responseEnvelope = await this.transport.sendMessage(peer.nodeId, proposalEnvelope);

      if (!responseEnvelope) {
        this.peerRegistry.updateHealth(peer.nodeId, { isReachable: false });
        continue;
      }

      // Verify incoming response envelope signature & sender registration
      const envVal = verifyNetworkEnvelope(responseEnvelope, this.nodeRegistry, this.chainId);
      if (!envVal.valid) {
        continue;
      }

      if (responseEnvelope.messageType === 'BLOCK_ENDORSEMENT') {
        const payload = responseEnvelope.payload as BlockEndorsementPayload;
        const endorsement: BlockEndorsement = payload.endorsement;

        const addRes = this.proposalManager.addEndorsement(endorsement);

        if (addRes.valid && addRes.state === 'COMMITTED' && addRes.proof) {
          // Quorum Reached! Commit block locally and broadcast CONSENSUS_COMMIT to peers
          const appendRes = await this.ledgerEngine.appendBlock(proposal.block);
          if (!appendRes.valid) return appendRes;

          await this.broadcastCommitAnnouncement(proposal.block, addRes.proof);
          return { valid: true, proof: addRes.proof, block: proposal.block };
        }
      }
    }

    // Final check if quorum was achieved
    const finalRec = this.proposalManager.getProposalRecord(proposal.proposalId);
    if (finalRec?.state === 'COMMITTED' && finalRec.proof) {
      const appendRes = await this.ledgerEngine.appendBlock(proposal.block);
      if (!appendRes.valid) return appendRes;

      await this.broadcastCommitAnnouncement(proposal.block, finalRec.proof);
      return { valid: true, proof: finalRec.proof, block: proposal.block };
    }

    return {
      valid: false,
      code: 'QUORUM_NOT_REACHED',
      reason: `Consensus quorum not reached for proposal '${proposal.proposalId}' under policy '${policyId}'`,
    };
  }

  /**
   * Handle incoming BLOCK_PROPOSAL message from peer
   */
  async handleIncomingProposal(
    envelope: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null> {
    const payload = envelope.payload as BlockProposalPayload;
    const proposal: BlockProposal = payload.proposal;

    // 1. Verify proposal
    const recRes = this.proposalManager.receiveProposal(proposal);
    if (!recRes.valid) {
      return createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CONSENSUS_REJECT',
        chainId: this.chainId,
        payload: {
          proposalId: proposal.proposalId,
          reason: recRes.reason || 'Invalid proposal',
          code: recRes.code,
        } as ConsensusRejectPayload,
      });
    }

    // 2. Verify previousBlockHash link against local ledger head
    const localLatest = await this.ledgerEngine.getLatestBlock();
    if (localLatest) {
      if (proposal.previousBlockHash !== localLatest.blockHash) {
        return createNetworkEnvelope({
          senderNode: this.localNode,
          messageType: 'CONSENSUS_REJECT',
          chainId: this.chainId,
          payload: {
            proposalId: proposal.proposalId,
            reason: `Proposal previousBlockHash '${proposal.previousBlockHash}' does not match local head '${localLatest.blockHash}'`,
            code: 'DIVERGED',
          } as ConsensusRejectPayload,
        });
      }
    }

    // 3. Create endorsement
    const endRes = this.proposalManager.createEndorsement(proposal.proposalId);
    if (!endRes.valid || !endRes.endorsement) {
      return createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CONSENSUS_REJECT',
        chainId: this.chainId,
        payload: {
          proposalId: proposal.proposalId,
          reason: endRes.reason || 'Endorsement generation rejected',
          code: endRes.code,
        } as ConsensusRejectPayload,
      });
    }

    return createNetworkEnvelope({
      senderNode: this.localNode,
      messageType: 'BLOCK_ENDORSEMENT',
      chainId: this.chainId,
      payload: { endorsement: endRes.endorsement } as BlockEndorsementPayload,
    });
  }

  /**
   * Handle incoming CONSENSUS_COMMIT message from peer
   */
  async handleIncomingCommit(
    envelope: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null> {
    const payload = envelope.payload as ConsensusCommitPayload;
    const block: LedgerBlock = payload.block;
    const proof: PoAConsensusProof = payload.proof;

    // 1. Independently verify consensus proof
    const proofVal = this.consensusEngine.validateConsensusProof(block, proof);
    if (!proofVal.valid) {
      return createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CONSENSUS_REJECT',
        chainId: this.chainId,
        payload: {
          proposalId: proof.proposalId || 'unknown',
          reason: `Consensus proof validation failed: ${proofVal.reason}`,
          code: proofVal.code,
        } as ConsensusRejectPayload,
      });
    }

    // Attach proof to block
    block.consensusProof = proof;

    // 2. Independently append block to local ledger
    const appendRes = await this.ledgerEngine.appendBlock(block);
    if (!appendRes.valid) {
      return createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CONSENSUS_REJECT',
        chainId: this.chainId,
        payload: {
          proposalId: proof.proposalId || 'unknown',
          reason: `Failed to append committed block: ${appendRes.reason}`,
          code: appendRes.code,
        } as ConsensusRejectPayload,
      });
    }

    return createNetworkEnvelope({
      senderNode: this.localNode,
      messageType: 'PONG',
      chainId: this.chainId,
      payload: { committedHeight: block.header.height, blockHash: block.blockHash },
    });
  }

  /**
   * Broadcast CONSENSUS_COMMIT announcement envelope to all enabled peers
   */
  private async broadcastCommitAnnouncement(
    block: LedgerBlock,
    proof: PoAConsensusProof,
  ): Promise<void> {
    const peers = this.peerRegistry.listPeers().filter((p) => p.isEnabled);

    for (const peer of peers) {
      const commitEnvelope = createNetworkEnvelope({
        senderNode: this.localNode,
        messageType: 'CONSENSUS_COMMIT',
        chainId: this.chainId,
        payload: { block, proof } as ConsensusCommitPayload,
      });

      await this.transport.sendMessage(peer.nodeId, commitEnvelope);
    }
  }
}
