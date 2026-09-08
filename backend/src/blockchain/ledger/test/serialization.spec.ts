/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/test/serialization.spec.ts
 */

import { canonicalSerialize } from '../serialization';

describe('Canonical Serialization Module', () => {
  it('should produce identical serialized string regardless of key ordering', () => {
    const objA = { z: 1, a: 'test', m: true };
    const objB = { a: 'test', m: true, z: 1 };

    expect(canonicalSerialize(objA)).toEqual(canonicalSerialize(objB));
  });

  it('should handle nested objects deterministically', () => {
    const objA = { b: { y: 2, x: 1 }, a: [1, 2] };
    const objB = { a: [1, 2], b: { x: 1, y: 2 } };

    expect(canonicalSerialize(objA)).toEqual(canonicalSerialize(objB));
  });

  it('should ignore undefined properties', () => {
    const objA = { a: 1, b: undefined };
    const objB = { a: 1 };

    expect(canonicalSerialize(objA)).toEqual(canonicalSerialize(objB));
  });
});
