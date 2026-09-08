/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN LEDGER ENGINE
 * File: backend/src/blockchain/ledger/serialization.ts
 *
 * Deterministic Canonical Serialization Module
 */

export function canonicalSerialize(val: any): string {
  if (val === null || val === undefined) {
    return 'null';
  }

  if (typeof val === 'boolean' || typeof val === 'number') {
    return String(val);
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (typeof val === 'bigint') {
    return JSON.stringify(val.toString());
  }

  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalSerialize(item)).join(',') + ']';
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val)
      .filter((k) => val[k] !== undefined)
      .sort();

    const entryStrs = keys.map((key) => {
      const keySerialized = JSON.stringify(key);
      const valSerialized = canonicalSerialize(val[key]);
      return `${keySerialized}:${valSerialized}`;
    });

    return '{' + entryStrs.join(',') + '}';
  }

  return JSON.stringify(String(val));
}
