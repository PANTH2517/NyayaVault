/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-integration.service.ts
 *
 * High-Level Application Integration Facade
 */

import { Injectable, Logger } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { BlockchainAnchorService } from './blockchain-anchor.service';
import { BlockchainVerificationService } from './blockchain-verification.service';
import { AuditCheckpointService } from './audit-checkpoint.service';
import { EvidenceVerificationResponse, AuditVerificationResponse } from './types';

@Injectable()
export class BlockchainIntegrationService {
  private readonly logger = new Logger(BlockchainIntegrationService.name);

  constructor(
    private readonly anchorService: BlockchainAnchorService,
    private readonly verificationService: BlockchainVerificationService,
    private readonly checkpointService: AuditCheckpointService,
  ) {}

  /**
   * Anchor Evidence Creation Event
   */
  async anchorEvidenceCreation(
    caseId: string,
    documentId: string,
    versionId: string,
    sha256Hash: string,
    role = RoleName.INVESTIGATING_OFFICER,
  ) {
    return this.anchorService.submitAnchorIntent({
      eventType: 'EVIDENCE_CREATED',
      role,
      caseId,
      documentId,
      versionId,
      versionNumber: 1,
      evidenceHash: sha256Hash,
    });
  }

  /**
   * Anchor Evidence Version Creation Event (v2, v3, etc.)
   */
  async anchorVersionCreation(
    caseId: string,
    documentId: string,
    versionId: string,
    versionNumber: number,
    sha256Hash: string,
    role = RoleName.INVESTIGATING_OFFICER,
  ) {
    return this.anchorService.submitAnchorIntent({
      eventType: 'EVIDENCE_VERSION_CREATED',
      role,
      caseId,
      documentId,
      versionId,
      versionNumber,
      evidenceHash: sha256Hash,
    });
  }

  /**
   * Anchor Document Approval Event
   */
  async anchorDocumentApproval(
    caseId: string,
    documentId: string,
    versionId: string,
    approvalId: string,
    role = RoleName.SUPERVISOR,
  ) {
    return this.anchorService.submitAnchorIntent({
      eventType: 'EVIDENCE_APPROVED',
      role,
      caseId,
      documentId,
      versionId,
      approvalId,
    });
  }

  /**
   * Anchor Document Sealing Event (Uses SEALED_EVIDENCE policy requiring 3/4 quorum)
   */
  async anchorDocumentSealing(
    caseId: string,
    documentId: string,
    versionId: string,
    sha256Hash: string,
    role = RoleName.SUPERVISOR,
  ) {
    return this.anchorService.submitAnchorIntent({
      eventType: 'EVIDENCE_SEALED',
      role,
      caseId,
      documentId,
      versionId,
      evidenceHash: sha256Hash,
    });
  }

  /**
   * Anchor Tamper / Integrity Failure Incident Event
   */
  async anchorTamperIncident(
    caseId: string,
    documentId: string,
    versionId: string,
    expectedHash: string,
    actualHash: string,
    incidentId: string,
    role = RoleName.ADMIN,
  ) {
    return this.anchorService.submitAnchorIntent({
      eventType: 'INTEGRITY_TAMPER_DETECTED',
      role,
      caseId,
      documentId,
      versionId,
      expectedHash,
      actualHash,
      incidentId,
    });
  }

  /**
   * Anchor Audit Log State Checkpoint
   */
  async createAuditCheckpoint(role = RoleName.ADMIN) {
    return this.checkpointService.createAuditCheckpoint(role);
  }

  /**
   * Verify Evidence Version Proof
   */
  async verifyEvidenceVersion(versionId: string): Promise<EvidenceVerificationResponse> {
    return this.verificationService.verifyEvidenceVersion(versionId);
  }

  /**
   * Retrieve Comprehensive Evidence Chain-of-Custody Provenance
   */
  async getEvidenceProvenance(versionId: string) {
    return this.verificationService.getEvidenceProvenance(versionId);
  }

  /**
   * Verify Audit Checkpoint Proof
   */
  async verifyAuditCheckpoint(): Promise<AuditVerificationResponse> {
    return this.verificationService.verifyAuditCheckpoint();
  }
}

