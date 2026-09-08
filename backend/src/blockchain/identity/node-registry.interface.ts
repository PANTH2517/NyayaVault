/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN NODE IDENTITY
 * File: backend/src/blockchain/identity/node-registry.interface.ts
 *
 * Node Registry Abstraction Interface
 */

import { KeyPairResult } from '../ledger/crypto';
import {
  NodeIdentity,
  PublicNodeIdentity,
  NodeKeyRecord,
  NodeType,
  SignedDomainPayload,
} from './types';

export interface VerifyNodeSignatureResult {
  valid: boolean;
  code?: string;
  reason?: string;
}

export interface INodeRegistry {
  getNode(nodeId: NodeType): NodeIdentity | null;
  getPublicNode(nodeId: NodeType): PublicNodeIdentity | null;
  getActiveKey(nodeId: NodeType): NodeKeyRecord | null;
  getKeyByVersion(nodeId: NodeType, version: number): NodeKeyRecord | null;
  isAuthorized(nodeId: NodeType): boolean;
  registerNode(node: NodeIdentity): void;
  rotateNodeKey(nodeId: NodeType, newKeypair?: KeyPairResult): NodeKeyRecord;
  revokeNodeKey(nodeId: NodeType, version: number): NodeKeyRecord;
  verifySignedPayload(
    signedPayload: SignedDomainPayload,
    originalPayload: string,
  ): VerifyNodeSignatureResult;
  listActiveNodes(): PublicNodeIdentity[];
}
