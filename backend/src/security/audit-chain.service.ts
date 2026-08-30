import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventType, IncidentType, IncidentSeverity } from '@prisma/client';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface CreateAuditEventParams {
  eventType: AuditEventType;
  userId?: string;
  caseId?: string;
  documentId?: string;
  versionId?: string;
  action: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministic canonical representation of audit event data
   */
  public computeCanonicalData(
    sequenceNumberStr: string,
    eventType: string,
    userId?: string,
    caseId?: string,
    documentId?: string,
    versionId?: string,
    action?: string,
    metadata?: any,
  ): string {
    const metaStr = metadata ? JSON.stringify(metadata) : '{}';
    return [
      sequenceNumberStr,
      eventType,
      userId || '',
      caseId || '',
      documentId || '',
      versionId || '',
      action || '',
      metaStr,
    ].join('|');
  }

  /**
   * Append-only write of cryptographically hash-chained audit event
   */
  async recordEvent(params: CreateAuditEventParams) {
    return this.prisma.$transaction(async (tx) => {
      const lastEvent = await tx.auditEvent.findFirst({
        orderBy: { sequenceNumber: 'desc' },
      });

      const previousEventHash = lastEvent ? lastEvent.currentEventHash : GENESIS_HASH;
      const nextSeqNumber = lastEvent ? BigInt(lastEvent.sequenceNumber) + 1n : 1n;

      const canonicalData = this.computeCanonicalData(
        nextSeqNumber.toString(),
        params.eventType,
        params.userId,
        params.caseId,
        params.documentId,
        params.versionId,
        params.action,
        params.metadata,
      );

      const currentEventHash = crypto
        .createHash('sha256')
        .update(`${previousEventHash}|${canonicalData}`)
        .digest('hex');

      const auditEvent = await tx.auditEvent.create({
        data: {
          eventType: params.eventType,
          userId: params.userId || null,
          caseId: params.caseId || null,
          documentId: params.documentId || null,
          versionId: params.versionId || null,
          action: params.action,
          metadata: params.metadata || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          previousEventHash,
          currentEventHash,
        },
      });

      return {
        ...auditEvent,
        sequenceNumber: auditEvent.sequenceNumber.toString(),
      };
    });
  }

  /**
   * Complete cryptographic audit chain verification
   */
  async verifyChain() {
    const checkedAt = new Date().toISOString();
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });

    if (events.length === 0) {
      return { valid: true, totalEvents: 0, checkedAt };
    }

    let expectedPreviousHash = GENESIS_HASH;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const seqNum = Number(event.sequenceNumber);

      // 1. Verify previous hash pointer
      if (event.previousEventHash !== expectedPreviousHash) {
        this.logger.error(`Audit chain broken at sequence ${seqNum}: Previous hash mismatch`);
        await this.handleVerificationFailure(
          seqNum,
          `Previous event hash mismatch at sequence ${seqNum}`,
        );
        return {
          valid: false,
          brokenAtSequence: seqNum,
          reason: 'PREVIOUS_HASH_MISMATCH',
          checkedAt,
        };
      }

      // 2. Recompute current canonical event hash
      const canonicalData = this.computeCanonicalData(
        event.sequenceNumber.toString(),
        event.eventType,
        event.userId || undefined,
        event.caseId || undefined,
        event.documentId || undefined,
        event.versionId || undefined,
        event.action,
        event.metadata,
      );

      const recomputedHash = crypto
        .createHash('sha256')
        .update(`${expectedPreviousHash}|${canonicalData}`)
        .digest('hex');

      if (recomputedHash !== event.currentEventHash) {
        this.logger.error(`Audit chain broken at sequence ${seqNum}: Canonical hash mismatch`);
        await this.handleVerificationFailure(
          seqNum,
          `Canonical content hash mismatch at sequence ${seqNum}`,
        );
        return {
          valid: false,
          brokenAtSequence: seqNum,
          reason: 'CANONICAL_HASH_MISMATCH',
          checkedAt,
        };
      }

      // Advance expected previous hash for next link in chain
      expectedPreviousHash = event.currentEventHash;
    }

    return {
      valid: true,
      totalEvents: events.length,
      checkedAt,
    };
  }

  private async handleVerificationFailure(sequenceNumber: number, reason: string) {
    try {
      // Check if an OPEN audit verification failure incident already exists
      const existingIncident = await this.prisma.securityIncident.findFirst({
        where: {
          incidentType: IncidentType.AUDIT_CHAIN_VERIFICATION_FAILED,
          status: 'OPEN',
        },
      });

      if (!existingIncident) {
        await this.prisma.securityIncident.create({
          data: {
            incidentType: IncidentType.AUDIT_CHAIN_VERIFICATION_FAILED,
            severity: IncidentSeverity.CRITICAL,
            description: `Cryptographic audit chain verification failure at sequence ${sequenceNumber}: ${reason}`,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to record audit verification security incident: ${err.message}`);
    }
  }
}
