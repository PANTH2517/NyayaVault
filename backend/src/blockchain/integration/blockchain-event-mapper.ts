/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-event-mapper.ts
 *
 * Event & Context Mapper for Application ↔ Blockchain Integration
 */

import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { RoleName } from '@prisma/client';
import { NodeType } from '../ledger/types';
import {
  ApplicationEventType,
  BlockchainAnchorIntentParams,
  EVENT_TO_POLICY_MAP,
  ROLE_TO_NODE_MAP,
} from './types';

@Injectable()
export class BlockchainEventMapper {
  /**
   * Map NyayaVault application role to permissioned node identity
   */
  mapRoleToNodeId(role?: RoleName): NodeType {
    if (!role) return 'POLICE_NODE';
    return ROLE_TO_NODE_MAP[role] || 'POLICE_NODE';
  }

  /**
   * Map application event type to consensus policy ID
   */
  mapEventToPolicyId(eventType: ApplicationEventType): string {
    return EVENT_TO_POLICY_MAP[eventType] || 'STANDARD_ANCHOR';
  }

  /**
   * Compute deterministic idempotency key for an anchor intent
   */
  computeIdempotencyKey(params: BlockchainAnchorIntentParams): string {
    const rawKeyComponents = [
      params.eventType,
      params.caseId || '',
      params.documentId || '',
      params.versionId || '',
      params.auditSequenceNumber ? params.auditSequenceNumber.toString() : '',
      params.evidenceHash || params.expectedHash || '',
      params.approvalId || '',
      params.incidentId || '',
    ];

    const composite = rawKeyComponents.join(':');
    return crypto.createHash('sha256').update(composite).digest('hex');
  }
}
