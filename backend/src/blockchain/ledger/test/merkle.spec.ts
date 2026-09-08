/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/test/merkle.spec.ts
 */

import { buildMerkleTree, EMPTY_MERKLE_ROOT } from '../merkle';

describe('Merkle Tree Implementation', () => {
  it('should return empty root for empty transaction array', () => {
    const result = buildMerkleTree([]);
    expect(result.root).toEqual(EMPTY_MERKLE_ROOT);
  });

  it('should handle single transaction deterministically', () => {
    const txHashes = ['a1b2c3d4e5f6'];
    const result = buildMerkleTree(txHashes);
    expect(result.root).toEqual('a1b2c3d4e5f6');
  });

  it('should construct Merkle root for even transaction count', () => {
    const txHashes = ['hash1', 'hash2'];
    const result = buildMerkleTree(txHashes);
    expect(result.root).toBeDefined();
    expect(result.root.length).toEqual(64);
  });

  it('should handle odd transaction count using duplicate-last-node rule', () => {
    const txHashesOdd = ['hash1', 'hash2', 'hash3'];
    const resultOdd = buildMerkleTree(txHashesOdd);

    expect(resultOdd.root).toBeDefined();
    expect(resultOdd.root.length).toEqual(64);
  });

  it('should produce identical root for identical input', () => {
    const txHashes = ['hashA', 'hashB', 'hashC'];
    const res1 = buildMerkleTree(txHashes);
    const res2 = buildMerkleTree(txHashes);

    expect(res1.root).toEqual(res2.root);
  });
});
