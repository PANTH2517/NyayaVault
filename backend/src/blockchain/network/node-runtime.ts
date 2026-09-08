/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NETWORK
 * File: backend/src/blockchain/network/node-runtime.ts
 *
 * Independent Blockchain Node Process Runtime Execution Unit
 */

import { ILedgerStore } from '../ledger/ledger-store.interface';
import { InMemoryLedgerStore } from '../ledger/in-memory-ledger-store';
import { LedgerEngine } from '../ledger/ledger-engine';
import { IConsensusEngine, DefaultPoAConsensusEngine } from '../ledger/consensus-interface';
import { INodeRegistry } from '../identity/node-registry.interface';
import { NodeIdentity, NodeType } from '../identity/types';
import { LedgerBlock } from '../ledger/types';
import { INodeTransport } from './transport.interface';
import { PeerRegistry } from './peer-registry';
import { PeerAuthenticator } from './peer-authenticator';
import { ChainSynchronizer, SyncResult } from './chain-synchronizer';
import { createNetworkEnvelope, verifyNetworkEnvelope } from './envelope';

import {
  BlockRequestPayload,
  BlockResponsePayload,
  ChainRequestPayload,
  ChainResponsePayload,
  NetworkMessageEnvelope,
  NodeNetworkStatus,
  NodeRuntimeState,
  PeerSyncState,
  StatusResponsePayload,
} from './types';

import { ChainRehydrationService } from '../ledger/chain-rehydration';
import { ConsensusPolicyRegistry } from '../consensus/policy-registry';
import { PoAConsensusEngine } from '../consensus/poa-consensus-engine';
import { ProposalManager } from '../consensus/proposal-manager';
import { ConsensusNetworkHandler } from '../consensus/consensus-network-handler';
import { BlockchainTransactionBuilder } from '../integration/blockchain-transaction-builder';
import { forgeBlock } from '../ledger/block';
import { LedgerNodeIdentity } from '../ledger/types';

export type NodeLifecycleState = 'INITIALIZING' | 'REHYDRATING' | 'READY' | 'FAILED' | 'DIVERGED' | 'SHUTTING_DOWN';

export interface NodeRuntimeConfig {
  nodeIdentity: NodeIdentity;
  nodeRegistry: INodeRegistry;
  ledgerStore?: ILedgerStore;
  consensusEngine?: IConsensusEngine;
  transport: INodeTransport;
  chainId?: string;
}

export class NodeRuntime {
  public readonly nodeId: NodeType;
  public readonly chainId: string;
  public readonly nodeIdentity: NodeIdentity;
  public readonly nodeRegistry: INodeRegistry;
  public readonly ledgerStore: ILedgerStore;
  public readonly ledgerEngine: LedgerEngine;
  public readonly peerRegistry: PeerRegistry;
  public readonly authenticator: PeerAuthenticator;
  public readonly synchronizer: ChainSynchronizer;
  public readonly transport: INodeTransport;
  public readonly consensusPolicyRegistry: ConsensusPolicyRegistry;
  public readonly poaConsensusEngine: PoAConsensusEngine;
  public readonly proposalManager: ProposalManager;
  public readonly consensusNetworkHandler: ConsensusNetworkHandler;

  public lifecycleState: NodeLifecycleState = 'INITIALIZING';
  private syncState: PeerSyncState = 'IDLE';
  private lastSyncTimestamp = '';
  private lastError?: string;
  private isRunning = false;

  constructor(config: NodeRuntimeConfig) {
    this.nodeIdentity = config.nodeIdentity;
    this.nodeId = config.nodeIdentity.nodeId;
    this.chainId = config.chainId || 'nyayavault-mainnet-1';
    this.nodeRegistry = config.nodeRegistry;
    this.ledgerStore = config.ledgerStore || new InMemoryLedgerStore(this.chainId);
    this.transport = config.transport;

    this.consensusPolicyRegistry = new ConsensusPolicyRegistry();
    this.poaConsensusEngine = new PoAConsensusEngine(
      this.nodeRegistry,
      this.consensusPolicyRegistry,
    );

    const consensusEngine = config.consensusEngine || this.poaConsensusEngine;

    this.ledgerEngine = new LedgerEngine({
      store: this.ledgerStore,
      consensusEngine,
      chainId: this.chainId,
    });

    this.peerRegistry = new PeerRegistry(this.nodeId);
    if ('peerUrls' in (this.transport as any)) {
      const peerUrlsMap = (this.transport as any).peerUrls as Map<NodeType, string>;
      if (peerUrlsMap) {
        for (const [pId, url] of peerUrlsMap.entries()) {
          const pRec = this.peerRegistry.getPeer(pId);
          if (pRec) {
            pRec.endpoint = url;
          }
        }
      }
    }
    this.authenticator = new PeerAuthenticator(
      this.nodeIdentity,
      this.nodeRegistry,
      this.chainId,
    );

    this.synchronizer = new ChainSynchronizer(
      this.nodeIdentity,
      this.nodeRegistry,
      this.ledgerEngine,
      this.peerRegistry,
      this.transport,
      this.chainId,
    );

    this.proposalManager = new ProposalManager({
      localNode: this.nodeIdentity,
      nodeRegistry: this.nodeRegistry,
      policyRegistry: this.consensusPolicyRegistry,
      chainId: this.chainId,
    });

    this.consensusNetworkHandler = new ConsensusNetworkHandler({
      localNode: this.nodeIdentity,
      nodeRegistry: this.nodeRegistry,
      ledgerEngine: this.ledgerEngine,
      peerRegistry: this.peerRegistry,
      transport: this.transport,
      proposalManager: this.proposalManager,
      consensusEngine: this.poaConsensusEngine,
      chainId: this.chainId,
    });
  }


  /**
   * Start node runtime, execute chain rehydration, and register message transport listener
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.lifecycleState = 'REHYDRATING';

    // 1. Rehydrate & validate complete persisted ledger chain
    const rehydrator = new ChainRehydrationService(
      this.ledgerStore,
      this.poaConsensusEngine,
      this.nodeId,
      this.chainId,
    );

    const rehydRes = await rehydrator.rehydrateChain();
    if (!rehydRes.valid) {
      this.lifecycleState = 'FAILED';
      this.lastError = `[${rehydRes.code}] ${rehydRes.reason}`;
      throw new Error(`Node '${this.nodeId}' chain rehydration failed: ${this.lastError}`);
    }

    this.lifecycleState = 'READY';

    // Register incoming message transport handler for this node identity
    this.transport.registerHandler(this.nodeId, async (msg) => this.handleIncomingMessage(msg));

    this.isRunning = true;
  }

  /**
   * Stop node runtime and unregister message transport listener
   */
  stop(): void {
    if (!this.isRunning) return;
    this.transport.unregisterHandler(this.nodeId);
    this.isRunning = false;
  }

  /**
   * Expose structured node state without exposing sensitive private key material
   */
  async getNodeState(): Promise<NodeRuntimeState> {
    const height = await this.ledgerEngine.getHeight();
    const latest = await this.ledgerEngine.getLatestBlock();

    return {
      nodeId: this.nodeId,
      chainId: this.chainId,
      currentHeight: height.toString(),
      latestBlockHash: latest?.blockHash || '',
      peerHealth: this.peerRegistry.listHealth(),
      syncState: this.syncState,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastError: this.lastError,
      nodeKeyVersion: this.nodeIdentity.currentVersion,
    };
  }

  /**
   * Route incoming network message envelope to appropriate RPC handler
   */
  async handleIncomingMessage(
    envelope: NetworkMessageEnvelope,
  ): Promise<NetworkMessageEnvelope | null> {
    // 1. Verify envelope cryptographic signature & sender validity
    const envVal = verifyNetworkEnvelope(envelope, this.nodeRegistry, this.chainId);
    if (!envVal.valid) {
      // Reject invalid or tampered message envelope
      return null;
    }

    // Update peer contact health
    this.peerRegistry.updateHealth(envelope.senderNodeId, {
      isReachable: true,
      lastContactAt: new Date().toISOString(),
    });

    switch (envelope.messageType) {
      case 'HELLO_HANDSHAKE': {
        const authVal = this.authenticator.authenticateHandshake(envelope);
        if (!authVal.valid) {
          this.peerRegistry.updateHealth(envelope.senderNodeId, { isAuthenticated: false });
          return null;
        }

        this.peerRegistry.updateHealth(envelope.senderNodeId, { isAuthenticated: true });

        const height = await this.ledgerEngine.getHeight();
        const latest = await this.ledgerEngine.getLatestBlock();
        const genesis = await this.ledgerEngine.getBlockByHeight(0n);

        const statusPayload: StatusResponsePayload = {
          nodeId: this.nodeId,
          chainId: this.chainId,
          currentHeight: height.toString(),
          latestBlockHash: latest?.blockHash || '',
          genesisHash: genesis?.blockHash || '',
          protocolVersion: '1.0',
          timestamp: new Date().toISOString(),
        };

        return createNetworkEnvelope({
          senderNode: this.nodeIdentity,
          messageType: 'HELLO_RESPONSE',
          chainId: this.chainId,
          payload: statusPayload,
        });
      }

      case 'STATUS_REQUEST': {
        const height = await this.ledgerEngine.getHeight();
        const latest = await this.ledgerEngine.getLatestBlock();
        const genesis = await this.ledgerEngine.getBlockByHeight(0n);

        const statusPayload: StatusResponsePayload = {
          nodeId: this.nodeId,
          chainId: this.chainId,
          currentHeight: height.toString(),
          latestBlockHash: latest?.blockHash || '',
          genesisHash: genesis?.blockHash || '',
          protocolVersion: '1.0',
          timestamp: new Date().toISOString(),
        };


        return createNetworkEnvelope({
          senderNode: this.nodeIdentity,
          messageType: 'STATUS_RESPONSE',
          chainId: this.chainId,
          payload: statusPayload,
        });
      }

      case 'BLOCK_REQUEST': {
        const reqPayload = envelope.payload as BlockRequestPayload;
        let block = null;

        if (reqPayload.height !== undefined) {
          block = await this.ledgerEngine.getBlockByHeight(reqPayload.height);
        } else if (reqPayload.blockHash) {
          block = await this.ledgerEngine.getBlockByHash(reqPayload.blockHash);
        }

        const respPayload: BlockResponsePayload = {
          found: !!block,
          block: block || undefined,
        };

        return createNetworkEnvelope({
          senderNode: this.nodeIdentity,
          messageType: 'BLOCK_RESPONSE',
          chainId: this.chainId,
          payload: respPayload,
        });
      }

      case 'CHAIN_REQUEST': {
        const reqPayload = envelope.payload as ChainRequestPayload;
        const fromH = BigInt(reqPayload.fromHeight || '0');
        const limit = Math.min(reqPayload.limit || 10, 100);

        const currentHeight = await this.ledgerEngine.getHeight();
        const blocks = [];

        for (let h = fromH; h <= currentHeight && blocks.length < limit; h++) {
          const b = await this.ledgerEngine.getBlockByHeight(h);
          if (b) {
            blocks.push(b);
          }
        }

        const respPayload: ChainResponsePayload = {
          fromHeight: fromH.toString(),
          count: blocks.length,
          blocks,
          currentHeight: currentHeight.toString(),
        };

        return createNetworkEnvelope({
          senderNode: this.nodeIdentity,
          messageType: 'CHAIN_RESPONSE',
          chainId: this.chainId,
          payload: respPayload,
        });
      }

      case 'PING': {
        return createNetworkEnvelope({
          senderNode: this.nodeIdentity,
          messageType: 'PONG',
          chainId: this.chainId,
          payload: { timestamp: new Date().toISOString() },
        });
      }

      case 'BLOCK_PROPOSAL': {
        return this.consensusNetworkHandler.handleIncomingProposal(envelope);
      }

      case 'CONSENSUS_COMMIT': {
        return this.consensusNetworkHandler.handleIncomingCommit(envelope);
      }

      default:
        return null;
    }
  }

  /**
   * Propose a block for network consensus endorsement and commit to local ledger
   */
  async proposeAndCommitBlock(
    block: LedgerBlock,
    policyId = 'STANDARD_ANCHOR',
    timeoutMs = 60000,
  ) {
    if (this.lifecycleState !== 'READY') {
      return {
        valid: false,
        code: 'NODE_NOT_READY',
        reason: `Node '${this.nodeId}' is in lifecycle state '${this.lifecycleState}' and cannot process block proposals`,
      };
    }
    return this.consensusNetworkHandler.proposeAndCommitBlock(block, policyId, timeoutMs);
  }

  /**
   * Application-to-Node Anchor Submission: Builds canonical transaction, forges candidate block, and executes consensus
   */
  async proposeAndCommitAnchor(
    params: Record<string, any>,
    policyId = 'STANDARD_ANCHOR',
    timeoutMs = 60000,
  ) {
    if (this.lifecycleState !== 'READY') {
      return {
        valid: false,
        code: 'NODE_NOT_READY',
        reason: `Node '${this.nodeId}' is in lifecycle state '${this.lifecycleState}' and cannot process anchor proposals`,
      };
    }

    const latestBlock = (await this.ledgerEngine.getLatestBlock()) || (await this.ledgerEngine.initialize());
    const txBuilder = new BlockchainTransactionBuilder();
    const signer: LedgerNodeIdentity = {
      nodeId: this.nodeId,
      name: `NyayaVault ${this.nodeId}`,
      publicKeyPem: this.nodeIdentity.keys[0].publicKeyPem,
      privateKeyPem: this.nodeIdentity.privateKeysByVersion.get(this.nodeIdentity.currentVersion) || '',
    };

    const nonce = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);
    const unsignedTx = txBuilder.buildTransaction(params as any, this.nodeId, nonce, this.chainId);
    const signedTx = txBuilder.signTransactionPayload(unsignedTx, signer);

    const candidateBlock = forgeBlock({
      previousBlock: latestBlock,
      transactions: [signedTx],
      proposerNode: this.nodeId,
    });

    return this.consensusNetworkHandler.proposeAndCommitBlock(candidateBlock, policyId, timeoutMs);
  }


  /**
   * Initiate peer connection, mutual authentication handshake, and ledger state synchronization
   */
  async connectAndSyncPeer(targetNodeId: NodeType): Promise<SyncResult> {
    // 1. Perform Handshake
    const handshakeEnv = this.authenticator.createHandshakeEnvelope();
    const handshakeResp = await this.transport.sendMessage(targetNodeId, handshakeEnv);

    if (!handshakeResp) {
      this.peerRegistry.updateHealth(targetNodeId, {
        isReachable: false,
        isAuthenticated: false,
        syncState: 'ERROR',
      });
      return {
        success: false,
        blocksSynced: 0,
        error: `Target peer '${targetNodeId}' is unreachable`,
      };
    }

    const authVal = this.authenticator.authenticateHandshake(handshakeResp);
    if (!authVal.valid) {
      this.peerRegistry.updateHealth(targetNodeId, {
        isReachable: true,
        isAuthenticated: false,
        syncState: 'ERROR',
      });
      return {
        success: false,
        blocksSynced: 0,
        error: `Peer handshake authentication failed: ${authVal.reason}`,
      };
    }

    this.peerRegistry.updateHealth(targetNodeId, {
      isReachable: true,
      isAuthenticated: true,
    });

    // 2. Request Peer Status
    const statusReqEnv = createNetworkEnvelope({
      senderNode: this.nodeIdentity,
      messageType: 'STATUS_REQUEST',
      chainId: this.chainId,
      payload: { requestedAt: new Date().toISOString() },
    });

    const statusRespEnv = await this.transport.sendMessage(targetNodeId, statusReqEnv);

    if (!statusRespEnv) {
      return {
        success: false,
        blocksSynced: 0,
        error: `Failed to receive status response from peer '${targetNodeId}'`,
      };
    }

    const peerStatusPayload = statusRespEnv.payload as StatusResponsePayload;

    const peerNodeStatus: NodeNetworkStatus = {
      nodeId: peerStatusPayload.nodeId,
      chainId: peerStatusPayload.chainId,
      currentHeight: peerStatusPayload.currentHeight,
      latestBlockHash: peerStatusPayload.latestBlockHash,
      genesisHash: peerStatusPayload.genesisHash,
      protocolVersion: peerStatusPayload.protocolVersion,
      timestamp: peerStatusPayload.timestamp,
    };

    // Update peer health with status info
    this.peerRegistry.updateHealth(targetNodeId, {
      currentHeight: peerStatusPayload.currentHeight,
      latestBlockHash: peerStatusPayload.latestBlockHash,
      lastContactAt: new Date().toISOString(),
    });

    // 3. Perform ledger block synchronization
    this.syncState = 'SYNCING';
    const syncResult = await this.synchronizer.synchronizeFromPeer(targetNodeId, peerNodeStatus);

    this.syncState = syncResult.success ? 'IDLE' : syncResult.divergence ? 'DIVERGED' : 'ERROR';
    if (syncResult.divergence?.diverged) {
      this.lifecycleState = 'DIVERGED';
    }
    this.lastSyncTimestamp = new Date().toISOString();

    if (!syncResult.success) {
      this.lastError = syncResult.error;
    } else {
      this.lastError = undefined;
    }

    return syncResult;
  }
}
