/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/merkle.ts
 *
 * Deterministic Merkle Tree Implementation
 */

import { hashSha256 } from './crypto';

export const EMPTY_MERKLE_ROOT =
  '0000000000000000000000000000000000000000000000000000000000000000';

export interface MerkleResult {
  root: string;
  tree: string[][];
}

/**
 * Construct a deterministic Merkle Tree from a list of transaction hashes
 *
 * Odd-Node Rule:
 * If a level contains an odd number of nodes (greater than 1),
 * the final node in that level is duplicated to pair with itself.
 * Example: [A, B, C] -> [A, B, C, C] -> [Hash(A|B), Hash(C|C)] -> MerkleRoot
 */
export function buildMerkleTree(txHashes: string[]): MerkleResult {
  if (!txHashes || txHashes.length === 0) {
    return {
      root: EMPTY_MERKLE_ROOT,
      tree: [[EMPTY_MERKLE_ROOT]],
    };
  }

  const sanitizedLeaves = txHashes.map((h) => h.toLowerCase());
  const tree: string[][] = [sanitizedLeaves];

  let currentLevel = sanitizedLeaves;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    // Duplicate last node if odd count
    const levelToPair =
      currentLevel.length % 2 !== 0
        ? [...currentLevel, currentLevel[currentLevel.length - 1]]
        : currentLevel;

    for (let i = 0; i < levelToPair.length; i += 2) {
      const left = levelToPair[i];
      const right = levelToPair[i + 1];
      const combinedHash = hashSha256(`${left}|${right}`);
      nextLevel.push(combinedHash);
    }

    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    tree,
  };
}

/**
 * Verify if a transaction hash is part of a Merkle Root given its proof path
 */
export function verifyMerkleProof(
  txHash: string,
  proof: { position: 'left' | 'right'; hash: string }[],
  expectedRoot: string,
): boolean {
  let current = txHash.toLowerCase();

  for (const step of proof) {
    const left = step.position === 'left' ? step.hash.toLowerCase() : current;
    const right = step.position === 'right' ? step.hash.toLowerCase() : current;
    current = hashSha256(`${left}|${right}`);
  }

  return current.toLowerCase() === expectedRoot.toLowerCase();
}
