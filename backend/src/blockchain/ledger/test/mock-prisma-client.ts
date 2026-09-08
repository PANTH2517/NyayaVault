/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER TESTS
 * File: backend/src/blockchain/ledger/test/mock-prisma-client.ts
 *
 * Mock PrismaClient with In-Memory Storage & Transaction Rollback Simulation
 */

export function createMockPrismaClient() {
  let chains = new Map<string, any>();
  let blocks = new Map<string, any>();
  let transactions = new Map<string, any>();
  let proofs = new Map<string, any>();
  let endorsements = new Map<string, any>();

  let idCounter = 1;
  let rootApi: any = null;

  function buildMockApi(isTx = false) {
    const api: any = {
      blockchainChain: {
        findUnique: async ({ where }: any) => {
          if (where.nodeId_chainId) {
            const key = `${where.nodeId_chainId.nodeId}_${where.nodeId_chainId.chainId}`;
            return chains.get(key) || null;
          }
          if (where.id) {
            for (const c of chains.values()) {
              if (c.id === where.id) return c;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const key = `${data.nodeId}_${data.chainId}`;
          const record = { id: `chain-${idCounter++}`, ...data };
          chains.set(key, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          for (const [key, c] of chains.entries()) {
            if (c.id === where.id) {
              const updated = { ...c, ...data };
              chains.set(key, updated);
              return updated;
            }
          }
          throw new Error('Chain not found for update');
        },
        deleteMany: async ({ where }: any) => {
          for (const [key, c] of Array.from(chains.entries())) {
            if (c.nodeId === where.nodeId && c.chainId === where.chainId) {
              chains.delete(key);
            }
          }
          return { count: 1 };
        },
      },

      blockchainBlock: {
        findUnique: async ({ where, include }: any) => {
          let found: any = null;
          if (where.nodeId_chainId_height) {
            const key = `${where.nodeId_chainId_height.nodeId}_${where.nodeId_chainId_height.chainId}_${where.nodeId_chainId_height.height}`;
            found = blocks.get(key);
          } else if (where.nodeId_chainId_blockHash) {
            for (const b of blocks.values()) {
              if (
                b.nodeId === where.nodeId_chainId_blockHash.nodeId &&
                b.chainId === where.nodeId_chainId_blockHash.chainId &&
                b.blockHash === where.nodeId_chainId_blockHash.blockHash
              ) {
                found = b;
                break;
              }
            }
          }

          if (!found) return null;
          return attachRelations(found, include);
        },

        findMany: async ({ where, orderBy, take, include }: any) => {
          let list: any[] = [];
          for (const b of blocks.values()) {
            if (b.nodeId === where.nodeId && b.chainId === where.chainId) {
              if (where.height && where.height.gte !== undefined) {
                if (b.height >= where.height.gte) list.push(b);
              } else {
                list.push(b);
              }
            }
          }

          if (orderBy?.height === 'asc') {
            list.sort((a, b) => (a.height < b.height ? -1 : a.height > b.height ? 1 : 0));
          }

          if (take) {
            list = list.slice(0, take);
          }

          return list.map((b) => attachRelations(b, include));
        },

        create: async ({ data }: any) => {
          const key = `${data.nodeId}_${data.chainId}_${data.height}`;
          if (blocks.has(key)) {
            throw new Error(`Duplicate block height ${data.height}`);
          }
          const record = { id: `block-${idCounter++}`, ...data };
          blocks.set(key, record);
          return record;
        },

        deleteMany: async ({ where }: any) => {
          for (const [key, b] of Array.from(blocks.entries())) {
            if (b.nodeId === where.nodeId && b.chainId === where.chainId) {
              blocks.delete(key);
              // Cascade delete transactions and proof
              for (const [txKey, t] of Array.from(transactions.entries())) {
                if (t.blockId === b.id) transactions.delete(txKey);
              }
              const proof = proofs.get(b.id);
              if (proof) {
                for (const [endKey, e] of Array.from(endorsements.entries())) {
                  if (e.proofId === proof.id) endorsements.delete(endKey);
                }
                proofs.delete(b.id);
              }
            }
          }
          return { count: 1 };
        },
      },

      blockchainTransaction: {
        create: async ({ data }: any) => {
          const key = `tx-${data.nodeId}_${data.chainId}_${data.txId}`;
          if (transactions.has(key)) {
            throw new Error(`Duplicate transaction ${data.txId}`);
          }
          const record = { id: `tx-rec-${idCounter++}`, ...data };
          transactions.set(key, record);
          return record;
        },
        count: async ({ where }: any) => {
          const key = `tx-${where.nodeId}_${where.chainId}_${where.txId}`;
          return transactions.has(key) ? 1 : 0;
        },
        findUnique: async ({ where }: any) => {
          if (where.nodeId_chainId_txId) {
            const key = `tx-${where.nodeId_chainId_txId.nodeId}_${where.nodeId_chainId_txId.chainId}_${where.nodeId_chainId_txId.txId}`;
            return transactions.get(key) || null;
          }
          return null;
        },
        deleteMany: async ({ where }: any) => {
          for (const [key, t] of Array.from(transactions.entries())) {
            if (t.nodeId === where.nodeId && t.chainId === where.chainId) {
              transactions.delete(key);
            }
          }
          return { count: 1 };
        },
      },

      blockchainConsensusProof: {
        create: async ({ data }: any) => {
          const record = { id: `proof-${idCounter++}`, ...data };
          proofs.set(data.blockId, record);
          return record;
        },
        deleteMany: async ({ where }: any) => {
          for (const [key, p] of Array.from(proofs.entries())) {
            if (p.nodeId === where.nodeId && p.chainId === where.chainId) {
              proofs.delete(key);
            }
          }
          return { count: 1 };
        },
      },

      blockchainEndorsement: {
        create: async ({ data }: any) => {
          const record = { id: `end-${idCounter++}`, ...data };
          const key = `${data.proofId}_${data.endorserNodeId}`;
          endorsements.set(key, record);
          return record;
        },
        deleteMany: async () => {
          endorsements.clear();
          return { count: 1 };
        },
      },

      $transaction: async (callback: (txApi: any) => Promise<any>) => {
        const snapshot = {
          chains: new Map(chains),
          blocks: new Map(blocks),
          transactions: new Map(transactions),
          proofs: new Map(proofs),
          endorsements: new Map(endorsements),
        };

        try {
          const txApi = buildMockApi(true);
          if (rootApi) {
            txApi.blockchainConsensusProof.create = (args: any) => rootApi.blockchainConsensusProof.create(args);
            txApi.blockchainBlock.create = (args: any) => rootApi.blockchainBlock.create(args);
            txApi.blockchainTransaction.create = (args: any) => rootApi.blockchainTransaction.create(args);
            txApi.blockchainChain.create = (args: any) => rootApi.blockchainChain.create(args);
            txApi.blockchainEndorsement.create = (args: any) => rootApi.blockchainEndorsement.create(args);
          }
          return await callback(txApi);
        } catch (err) {
          chains = snapshot.chains;
          blocks = snapshot.blocks;
          transactions = snapshot.transactions;
          proofs = snapshot.proofs;
          endorsements = snapshot.endorsements;
          throw err;
        }
      },

      // Helper for direct test manipulation/corruption
      _getRawStorage: () => ({ chains, blocks, transactions, proofs, endorsements }),
    };

    function attachRelations(b: any, include: any) {
      const copy = { ...b };
      if (include?.transactions) {
        const txs = [];
        for (const t of transactions.values()) {
          if (t.blockId === b.id) txs.push(t);
        }
        txs.sort((x, y) => x.txIndex - y.txIndex);
        copy.transactions = txs;
      }

      if (include?.consensusProof) {
        const proof = proofs.get(b.id);
        if (proof) {
          const pCopy = { ...proof };
          if (include.consensusProof.include?.endorsements) {
            const ends = [];
            for (const e of endorsements.values()) {
              if (e.proofId === proof.id) ends.push(e);
            }
            pCopy.endorsements = ends;
          }
          copy.consensusProof = pCopy;
        }
      }

      return copy;
    }

    return api;
  }

  rootApi = buildMockApi();
  return rootApi;
}
