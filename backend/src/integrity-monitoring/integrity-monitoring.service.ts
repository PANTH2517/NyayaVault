/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/integrity-monitoring/integrity-monitoring.service.ts
 *
 * Sub-Phase 1H: Advanced Tamper Monitoring & Real-Time Integrity Alerts Engine
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentIntegrityService } from '../security/document-integrity.service';
import { SecurityIncidentsService } from '../security/security-incidents.service';
import { AuditChainService } from '../security/audit-chain.service';
import { BlockchainAnchorService } from '../blockchain/integration/blockchain-anchor.service';
import { BlockchainIntegrationService } from '../blockchain/integration/blockchain-integration.service';
import { IncidentType, IncidentSeverity, AuditEventType } from '@prisma/client';

export interface IntegrityMonitoringStatus {
  enabled: boolean;
  intervalSeconds: number;
  batchSize: number;
  monitoringMode: string;
  isScanInProgress: boolean;
  lastScanStarted: string | null;
  lastScanCompleted: string | null;
  lastSuccessfulScan: string | null;
  versionsChecked: number;
  integrityFailuresDetected: number;
  operationalErrors: number;
  lastError: string | null;
  lastScanDurationMs: number | null;
}

export interface ScanExecutionResult {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  versionsChecked: number;
  failuresDetected: number;
  operationalErrors: number;
  processedVersionIds: string[];
}

@Injectable()
export class IntegrityMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrityMonitoringService.name);
  private timerHandle: NodeJS.Timeout | null = null;
  private isScanInProgress = false;

  // Operational metrics state (in-memory)
  private enabled = false;
  private intervalSeconds = 60;
  private batchSize = 10;
  private lastScanStarted: string | null = null;
  private lastScanCompleted: string | null = null;
  private lastSuccessfulScan: string | null = null;
  private versionsChecked = 0;
  private integrityFailuresDetected = 0;
  private operationalErrors = 0;
  private lastError: string | null = null;
  private lastScanDurationMs: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrityService: DocumentIntegrityService,
    private readonly incidentsService: SecurityIncidentsService,
    private readonly auditChainService: AuditChainService,
    @Optional() private readonly anchorService?: BlockchainAnchorService,
    @Optional() private readonly blockchainIntegrationService?: BlockchainIntegrationService,
  ) {
    this.configureFromEnvironment();
  }

  /**
   * Parse and validate environment settings
   */
  public configureFromEnvironment(): void {
    const rawEnabled = process.env.INTEGRITY_MONITOR_ENABLED;
    this.enabled = rawEnabled !== 'false';

    const rawInterval = parseInt(process.env.INTEGRITY_MONITOR_INTERVAL_SECONDS || '60', 10);
    this.intervalSeconds = !isNaN(rawInterval) && rawInterval > 0 ? rawInterval : 60;

    const rawBatch = parseInt(process.env.INTEGRITY_MONITOR_BATCH_SIZE || '10', 10);
    this.batchSize = !isNaN(rawBatch) && rawBatch > 0 ? rawBatch : 10;
  }

  /**
   * NestJS Lifecycle: Start scheduler if enabled
   */
  onModuleInit(): void {
    if (this.enabled) {
      this.startScheduler();
    } else {
      this.logger.log('Continuous Scheduled Integrity Monitoring is currently DISABLED in environment configuration');
    }
  }

  /**
   * NestJS Lifecycle: Clean shutdown of background timer
   */
  onModuleDestroy(): void {
    this.stopScheduler();
  }

  /**
   * Start scheduled timer interval
   */
  public startScheduler(): void {
    this.stopScheduler();
    this.enabled = true;
    this.logger.log(
      `Starting Continuous Scheduled Integrity Monitoring (Interval: ${this.intervalSeconds}s, Batch Size: ${this.batchSize})`
    );

    this.timerHandle = setInterval(async () => {
      try {
        await this.runIntegrityScan();
      } catch (err: any) {
        this.logger.error(`Scheduled integrity monitoring iteration failed safely: ${err.message}`);
      }
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stop scheduled timer interval
   */
  public stopScheduler(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
      this.logger.log('Stopped Continuous Scheduled Integrity Monitoring timer');
    }
  }

  /**
   * Execute a single bounded integrity scan iteration
   */
  async runIntegrityScan(): Promise<ScanExecutionResult> {
    if (this.isScanInProgress) {
      this.logger.debug('Integrity scan already in progress. Skipping overlapping execution.');
      return {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        versionsChecked: 0,
        failuresDetected: 0,
        operationalErrors: 0,
        processedVersionIds: [],
      };
    }

    this.isScanInProgress = true;
    const startTime = Date.now();
    const startedAtIso = new Date(startTime).toISOString();
    this.lastScanStarted = startedAtIso;
    this.lastError = null;

    let scanVersionsChecked = 0;
    let scanFailuresDetected = 0;
    let scanOperationalErrors = 0;
    const processedVersionIds: string[] = [];

    try {
      // 1. Discover eligible evidence versions in bounded batches
      const eligibleVersions = await this.prisma.documentVersion.findMany({
        where: {
          sha256Hash: { not: '' },
        },
        include: {
          document: {
            select: {
              id: true,
              caseId: true,
              title: true,
            },
          },
        },
        take: this.batchSize,
        orderBy: { createdAt: 'asc' },
      });

      for (const version of eligibleVersions) {
        try {
          processedVersionIds.push(version.id);

          // 2. Perform byte-level SHA-256 check
          const result = await this.integrityService.verifyDocumentVersionIntegrity(
            version.documentId,
            version.id
          );

          if (result.valid && !result.tampered) {
            // Clean evidence PASS
            scanVersionsChecked++;
            this.versionsChecked++;
          } else if (result.actualHash === 'STORAGE_OBJECT_UNREADABLE_OR_MISSING' || (result.error && result.error !== 'BYTE_LEVEL_SHA256_MISMATCH')) {
            // Storage operational/network failure - NOT TAMPER
            scanOperationalErrors++;
            this.operationalErrors++;
            this.logger.warn(
              `Storage operational check failure for document '${version.documentId}' version '${version.id}': ${result.error}`
            );
          } else if (result.tampered && result.error === 'BYTE_LEVEL_SHA256_MISMATCH') {
            // ACTUAL TAMPER DETECTED
            scanVersionsChecked++;
            scanFailuresDetected++;
            this.versionsChecked++;
            this.integrityFailuresDetected++;

            this.logger.error(
              `TAMPER DETECTED by Continuous Monitoring! Document '${version.documentId}' version '${version.id}'. Expected SHA-256: ${result.expectedHash}, Actual SHA-256: ${result.actualHash}`
            );

            // Trigger idempotent tamper workflows
            await this.handleTamperDetection(
              version.document.caseId,
              version.documentId,
              version.id,
              result.expectedHash,
              result.actualHash
            );
          }
        } catch (itemErr: any) {
          scanOperationalErrors++;
          this.operationalErrors++;
          this.logger.error(
            `Failed processing version '${version.id}' during integrity scan: ${itemErr.message}`
          );
        }
      }

      const endTime = Date.now();
      const completedAtIso = new Date(endTime).toISOString();
      const durationMs = endTime - startTime;

      this.lastScanCompleted = completedAtIso;
      this.lastSuccessfulScan = completedAtIso;
      this.lastScanDurationMs = durationMs;

      return {
        startedAt: startedAtIso,
        completedAt: completedAtIso,
        durationMs,
        versionsChecked: scanVersionsChecked,
        failuresDetected: scanFailuresDetected,
        operationalErrors: scanOperationalErrors,
        processedVersionIds,
      };
    } catch (scanErr: any) {
      this.lastError = scanErr.message;
      this.logger.error(`Critical exception during integrity scan execution: ${scanErr.message}`);
      throw scanErr;
    } finally {
      this.isScanInProgress = false;
    }
  }

  /**
   * Idempotently create security incident, audit event, and blockchain anchor upon tamper detection
   */
  private async handleTamperDetection(
    caseId: string,
    documentId: string,
    versionId: string,
    expectedHash: string,
    actualHash: string
  ): Promise<void> {
    const description = `AUTOMATED TAMPER MONITORING: Byte-level SHA-256 mismatch detected for document '${documentId}' version '${versionId}'. Trusted DB SHA-256: ${expectedHash}, Actual Storage SHA-256: ${actualHash}. Detection Source: CONTINUOUS_SCHEDULED_MONITORING.`;

    // 1. Create/Deduplicate Security Incident
    const incident = await this.incidentsService.createIncident({
      incidentType: IncidentType.DOCUMENT_TAMPER_DETECTED,
      severity: IncidentSeverity.CRITICAL,
      caseId,
      documentId,
      versionId,
      description,
    });

    // 2. Idempotently Emit Audit Event
    const existingAudit = await this.prisma.auditEvent.findFirst({
      where: {
        documentId,
        versionId,
        eventType: AuditEventType.INTEGRITY_FAILED,
      },
    });

    if (!existingAudit) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.INTEGRITY_FAILED,
        caseId,
        documentId,
        versionId,
        action: 'AUTOMATED_INTEGRITY_CHECK_FAILED',
        metadata: {
          expectedHash,
          actualHash,
          detectionSource: 'CONTINUOUS_SCHEDULED_MONITORING',
          incidentId: incident.id,
        },
      });
      this.logger.log(`Emitted hash-chained INTEGRITY_FAILED audit event for version '${versionId}'`);
    }

    // 3. Idempotently Create Blockchain Tamper Anchor
    if (this.blockchainIntegrationService) {
      try {
        await this.blockchainIntegrationService.anchorTamperIncident(
          caseId,
          documentId,
          versionId,
          expectedHash,
          actualHash,
          incident.id
        );
      } catch (bcErr: any) {
        this.logger.warn(`Blockchain tamper anchor trigger warning: ${bcErr.message}`);
      }
    } else if (this.anchorService) {
      try {
        await this.anchorService.submitAnchorIntent({
          eventType: 'INTEGRITY_TAMPER_DETECTED',
          caseId,
          documentId,
          versionId,
          evidenceHash: actualHash,
        });
      } catch (anchorErr: any) {
        this.logger.warn(`Blockchain anchor queue warning: ${anchorErr.message}`);
      }
    }
  }

  /**
   * Get operational monitoring status (ADMIN-only readout)
   */
  getMonitoringStatus(): IntegrityMonitoringStatus {
    return {
      enabled: this.enabled,
      intervalSeconds: this.intervalSeconds,
      batchSize: this.batchSize,
      monitoringMode: 'Continuous Scheduled Integrity Monitoring',
      isScanInProgress: this.isScanInProgress,
      lastScanStarted: this.lastScanStarted,
      lastScanCompleted: this.lastScanCompleted,
      lastSuccessfulScan: this.lastSuccessfulScan,
      versionsChecked: this.versionsChecked,
      integrityFailuresDetected: this.integrityFailuresDetected,
      operationalErrors: this.operationalErrors,
      lastError: this.lastError,
      lastScanDurationMs: this.lastScanDurationMs,
    };
  }
}
