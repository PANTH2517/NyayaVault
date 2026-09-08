/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/prisma-ledger-store.ts
 *
 * PostgreSQL Persistent Ledger Store Implementation via Prisma Client
 */

import { PrismaClient } from '@prisma/client';
import { ILedgerStore } from './ledger-store.interface';
import { createGenesisBlock } from './block';
import { LedgerBlock, LedgerTransaction, NodeType, TransactionType } from './types';
import { PoAConsensusProof } from '../consensus/types';

export interface PrismaLedgerStoreOptions {
  prisma: PrismaClient;
  nodeId: NodeType;
  chainId?: string;
}

export function mapPrismaBlockToDomain(prismaBlock: any): LedgerBlock {
  const transactions: LedgerTransaction[] = (prismaBlock.transactions || []).map((t: any) => ({
    txId: t.txId,
    chainId: t.chainId,
    txType: t.txType as TransactionType,
    originatingNode: t.originatingNode as NodeType,
    nonce: Number(t.nonce),
    version: '1.0',
    payload: (t.payload && typeof t.payload === 'object') ? t.payload : {},
    signatures: t.signatureHex
      ? [
          {
            nodeId: t.originatingNode,
            publicKeyPem: '',
            signatureHex: t.signatureHex,
            signedAt: t.timestamp,
          },
        ]
      : [],
    timestamp: t.timestamp,
  }));

  let consensusProof: PoAConsensusProof | undefined = undefined;

  if (prismaBlock.consensusProof) {
    const cp = prismaBlock.consensusProof;
    const endorsingSignatures = (cp.endorsements || []).map((e: any) => ({
      nodeId: e.endorserNodeId,
      keyVersion: e.keyVersion,
      keyFingerprint: e.keyFingerprint,
      publicKeyPem: e.publicKeyPem,
      signatureHex: e.signatureHex,
      signedAt: e.signedAt,
    }));

    consensusProof = {
      consensusType: (cp.consensusType || 'PROOF_OF_AUTHORITY') as any,
      consensusVersion: cp.consensusVersion || '1.0',
      proposalId: cp.proposalId,
      blockHash: cp.blockHash,
      chainId: cp.chainId,
      blockHeight: cp.blockHeight,
      policyId: cp.policyId,
      policyVersion: cp.policyVersion,
      requiredThreshold: cp.requiredThreshold,
      requiredNodeIds: Array.isArray(cp.requiredNodeIds)
        ? cp.requiredNodeIds
        : JSON.parse(cp.requiredNodeIds as any),
      endorsingSignatures,
      collectedAt: cp.collectedAt,
      commitTimestamp: cp.commitTimestamp,
    };
  }

  return {
    blockHash: prismaBlock.blockHash,
    header: {
      height: prismaBlock.height.toString(),
      chainId: prismaBlock.chainId,
      version: prismaBlock.version,
      previousBlockHash: prismaBlock.previousBlockHash,
      merkleRoot: prismaBlock.merkleRoot,
      timestamp: prismaBlock.timestamp,
      proposerNode: prismaBlock.proposerNode,
    },
    transactions,
    consensusProof,
  };
}

export class PrismaLedgerStore implements ILedgerStore {
  private readonly prisma: PrismaClient;
  private readonly nodeId: NodeType;
  private readonly chainId: string;

  constructor(options: PrismaLedgerStoreOptions) {
    this.prisma = options.prisma;
    this.nodeId = options.nodeId;
    this.chainId = options.chainId || 'nyayavault-mainnet-1';
  }

  /**
   * Initialize deterministic genesis block in store if empty
   */
  async initialize(): Promise<LedgerBlock> {
    const latest = await this.getLatestBlock();
    if (latest) {
      return latest;
    }
    const genesis = createGenesisBlock(this.chainId);
    await this.appendBlock(genesis);
    return genesis;
  }

  /**
   * Atomically append a block, transactions, consensus proof, endorsements, and chain metadata
   */
  async appendBlock(block: LedgerBlock): Promise<void> {
    const heightBigInt = BigInt(block.header.height);

    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch or initialize BlockchainChain record
      let chain = await tx.blockchainChain.findUnique({
        where: {
          nodeId_chainId: {
            nodeId: this.nodeId,
            chainId: this.chainId,
          },
        },
      });

      if (!chain) {
        chain = await tx.blockchainChain.create({
          data: {
            nodeId: this.nodeId,
            chainId: this.chainId,
            currentHeight: heightBigInt,
            currentBlockHash: block.blockHash,
            genesisBlockHash: block.blockHash,
            status: 'ACTIVE',
          },
        });
      } else {
        if (heightBigInt <= chain.currentHeight && heightBigInt !== 0n) {
          throw new Error(
            `Cannot append block at height ${heightBigInt}: Chain tip is already at height ${chain.currentHeight}`,
          );
        }
      }

      // 2. Create BlockchainBlock record
      const dbBlock = await tx.blockchainBlock.create({
        data: {
          nodeId: this.nodeId,
          chainId: this.chainId,
          height: heightBigInt,
          blockHash: block.blockHash,
          previousBlockHash: block.header.previousBlockHash,
          merkleRoot: block.header.merkleRoot,
          timestamp: block.header.timestamp,
          version: block.header.version || '1.0',
          proposerNode: block.header.proposerNode,
        },
      });

      // 3. Create BlockchainTransaction records
      for (let i = 0; i < block.transactions.length; i++) {
        const txObj = block.transactions[i];
        const primarySig = (txObj.signatures && txObj.signatures.length > 0)
          ? txObj.signatures[0].signatureHex
          : ((txObj as any).signatureHex || '');
        await tx.blockchainTransaction.create({
          data: {
            txId: txObj.txId,
            blockId: dbBlock.id,
            nodeId: this.nodeId,
            chainId: this.chainId,
            txIndex: i,
            txType: txObj.txType,
            originatingNode: txObj.originatingNode,
            nonce: BigInt(txObj.nonce),
            payload: txObj.payload as any,
            signatureHex: primarySig,
            timestamp: txObj.timestamp,
            keyVersion: (txObj as any).keyVersion || 1,
            keyFingerprint: (txObj as any).keyFingerprint || '',
          },
        });
      }

      // 4. Create BlockchainConsensusProof & BlockchainEndorsement records
      if (block.consensusProof) {
        const proof = block.consensusProof as PoAConsensusProof;
        const dbProof = await tx.blockchainConsensusProof.create({
          data: {
            blockId: dbBlock.id,
            nodeId: this.nodeId,
            chainId: this.chainId,
            consensusType: proof.consensusType || 'PROOF_OF_AUTHORITY',
            consensusVersion: proof.consensusVersion || '1.0',
            proposalId: proof.proposalId,
            blockHash: proof.blockHash || block.blockHash,
            blockHeight: proof.blockHeight || block.header.height,
            policyId: proof.policyId,
            policyVersion: proof.policyVersion || '1.0',
            requiredThreshold: proof.requiredThreshold,
            requiredNodeIds: (proof.requiredNodeIds || []) as any,
            collectedAt: proof.collectedAt || new Date().toISOString(),
            commitTimestamp: proof.commitTimestamp || new Date().toISOString(),
          },
        });

        for (const sig of proof.endorsingSignatures || []) {
          await tx.blockchainEndorsement.create({
            data: {
              proofId: dbProof.id,
              endorserNodeId: sig.nodeId,
              keyVersion: sig.keyVersion,
              keyFingerprint: sig.keyFingerprint,
              publicKeyPem: sig.publicKeyPem,
              signatureHex: sig.signatureHex,
              signedAt: sig.signedAt,
            },
          });
        }
      }

      // 5. Update chain tip metadata
      await tx.blockchainChain.update({
        where: { id: chain.id },
        data: {
          currentHeight: heightBigInt,
          currentBlockHash: block.blockHash,
        },
      });
    });
  }

  async getBlockByHeight(height: bigint | string): Promise<LedgerBlock | null> {
    const h = BigInt(height);
    const block = await this.prisma.blockchainBlock.findUnique({
      where: {
        nodeId_chainId_height: {
          nodeId: this.nodeId,
          chainId: this.chainId,
          height: h,
        },
      },
      include: {
        transactions: { orderBy: { txIndex: 'asc' } },
        consensusProof: { include: { endorsements: true } },
      },
    });

    return block ? mapPrismaBlockToDomain(block) : null;
  }

  async getBlockByHash(hash: string): Promise<LedgerBlock | null> {
    const block = await this.prisma.blockchainBlock.findUnique({
      where: {
        nodeId_chainId_blockHash: {
          nodeId: this.nodeId,
          chainId: this.chainId,
          blockHash: hash,
        },
      },
      include: {
        transactions: { orderBy: { txIndex: 'asc' } },
        consensusProof: { include: { endorsements: true } },
      },
    });

    return block ? mapPrismaBlockToDomain(block) : null;
  }

  async getLatestBlock(): Promise<LedgerBlock | null> {
    const chain = await this.prisma.blockchainChain.findUnique({
      where: { nodeId_chainId: { nodeId: this.nodeId, chainId: this.chainId } },
    });
    if (!chain) return null;

    const block = await this.prisma.blockchainBlock.findUnique({
      where: {
        nodeId_chainId_height: {
          nodeId: this.nodeId,
          chainId: this.chainId,
          height: chain.currentHeight,
        },
      },
      include: {
        transactions: { orderBy: { txIndex: 'asc' } },
        consensusProof: { include: { endorsements: true } },
      },
    });

    return block ? mapPrismaBlockToDomain(block) : null;
  }

  async getHeight(): Promise<bigint> {
    const chain = await this.prisma.blockchainChain.findUnique({
      where: { nodeId_chainId: { nodeId: this.nodeId, chainId: this.chainId } },
    });
    return chain ? chain.currentHeight : -1n;
  }

  async hasTransaction(txId: string): Promise<boolean> {
    const count = await this.prisma.blockchainTransaction.count({
      where: { nodeId: this.nodeId, chainId: this.chainId, txId },
    });
    return count > 0;
  }

  async getTransaction(txId: string): Promise<LedgerTransaction | null> {
    const t = await this.prisma.blockchainTransaction.findUnique({
      where: { nodeId_chainId_txId: { nodeId: this.nodeId, chainId: this.chainId, txId } },
    });
    if (!t) return null;
    return {
      txId: t.txId,
      chainId: t.chainId,
      txType: t.txType as TransactionType,
      originatingNode: t.originatingNode as NodeType,
      nonce: Number(t.nonce),
      version: '1.0',
      payload: (t.payload && typeof t.payload === 'object') ? (t.payload as Record<string, any>) : {},
      signatures: t.signatureHex
        ? [
            {
              nodeId: t.originatingNode,
              publicKeyPem: '',
              signatureHex: t.signatureHex,
              signedAt: t.timestamp,
            },
          ]
        : [],
      timestamp: t.timestamp,
    };
  }

  async getChain(): Promise<LedgerBlock[]> {
    const blocks = await this.prisma.blockchainBlock.findMany({
      where: { nodeId: this.nodeId, chainId: this.chainId },
      orderBy: { height: 'asc' },
      include: {
        transactions: { orderBy: { txIndex: 'asc' } },
        consensusProof: { include: { endorsements: true } },
      },
    });
    return blocks.map(mapPrismaBlockToDomain);
  }

  async getBlocksInRange(fromHeight: bigint, limit: number): Promise<LedgerBlock[]> {
    const blocks = await this.prisma.blockchainBlock.findMany({
      where: {
        nodeId: this.nodeId,
        chainId: this.chainId,
        height: { gte: fromHeight },
      },
      orderBy: { height: 'asc' },
      take: limit,
      include: {
        transactions: { orderBy: { txIndex: 'asc' } },
        consensusProof: { include: { endorsements: true } },
      },
    });
    return blocks.map(mapPrismaBlockToDomain);
  }

  /**
   * Clear all stored blocks, transactions, proofs, and chain metadata for this node and chain
   */
  async clear(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.blockchainBlock.deleteMany({
        where: { nodeId: this.nodeId, chainId: this.chainId },
      });
      await tx.blockchainChain.deleteMany({
        where: { nodeId: this.nodeId, chainId: this.chainId },
      });
    });
  }
}
