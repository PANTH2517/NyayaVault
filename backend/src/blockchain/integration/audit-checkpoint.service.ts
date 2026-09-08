/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/audit-checkpoint.service.ts
 *
 * Audit Ledger Checkpointing Service
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainAnchorService } from './blockchain-anchor.service';
import { RoleName } from '@prisma/client';

@Injectable()
export class AuditCheckpointService {
  private readonly logger = new Logger(AuditCheckpointService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anchorService: BlockchainAnchorService,
  ) {}

  /**
   * Anchor latest hash-chained audit ledger state on permissioned blockchain
   */
  async createAuditCheckpoint(userRole = RoleName.ADMIN) {
    const latestEvent = await this.prisma.auditEvent.findFirst({
      orderBy: { sequenceNumber: 'desc' },
    });

    if (!latestEvent) {
      this.logger.log('Skipping audit checkpoint: Audit log is empty');
      return null;
    }

    const seqNumberStr = latestEvent.sequenceNumber.toString();
    const latestHash = latestEvent.currentEventHash;

    const result = await this.anchorService.submitAnchorIntent({
      eventType: 'AUDIT_CHECKPOINT',
      role: userRole,
      auditSequenceNumber: seqNumberStr,
      evidenceHash: latestHash,
      metadata: {
        eventType: latestEvent.eventType,
        action: latestEvent.action,
        timestamp: latestEvent.createdAt,
      },
    });

    this.logger.log(`Created audit checkpoint anchor for sequence ${seqNumberStr} (Hash: ${latestHash})`);
    return result;
  }
}
