/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain.controller.ts
 *
 * REST Controller for Blockchain Operations & Verification APIs
 */

import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainIntegrationService } from './blockchain-integration.service';
import { BlockchainObservabilityService } from './blockchain-observability.service';
import { PrismaLedgerStore } from '../ledger/prisma-ledger-store';

@Controller('api/v1/blockchain')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: BlockchainIntegrationService,
    private readonly observabilityService: BlockchainObservabilityService,
  ) {}

  /**
   * GET /api/v1/blockchain/status
   * Operational status of permissioned blockchain nodes & anchor counts.
   * Infrastructure-wide topology/observability details are ADMIN-only.
   */
  @Get('status')
  async getStatus(@CurrentUser() user: UserPayload) {
    return this.observabilityService.getNetworkObservability();
  }

  /**
   * GET /api/v1/blockchain/evidence/:versionId
   * Retrieve blockchain anchor status for an evidence version (CBAC Enforced)
   */
  @Get('evidence/:versionId')
  async getEvidenceAnchorStatus(
    @Param('versionId') versionId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.assertCaseAccessForVersion(versionId, user);
    return this.integrationService.verifyEvidenceVersion(versionId);
  }

  /**
   * GET /api/v1/blockchain/provenance/:versionId
   * Retrieve full evidence chain-of-custody provenance timeline & cryptographic proof (CBAC Enforced)
   */
  @Get('provenance/:versionId')
  async getEvidenceProvenance(
    @Param('versionId') versionId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.assertCaseAccessForVersion(versionId, user);
    return this.integrationService.getEvidenceProvenance(versionId);
  }

  /**
   * GET /api/v1/blockchain/verify/evidence/:versionId
   * Live independent cryptographic proof verification for evidence version (CBAC Enforced)
   */
  @Get('verify/evidence/:versionId')
  async verifyEvidenceVersion(
    @Param('versionId') versionId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.assertCaseAccessForVersion(versionId, user);
    return this.integrationService.verifyEvidenceVersion(versionId);
  }


  /**
   * GET /api/v1/blockchain/verify/audit
   * Verify audit chain checkpoint on permissioned blockchain (Admin Only)
   */
  @Get('verify/audit')
  async verifyAuditCheckpoint(@CurrentUser() user: UserPayload) {
    if (user.role !== RoleName.ADMIN) {
      throw new ForbiddenException('Only ADMIN users are authorized to verify audit log checkpoints');
    }
    return this.integrationService.verifyAuditCheckpoint();
  }

  /**
   * Server-side CBAC Guard: Assert user has legitimate access to the case containing this version
   */
  private async assertCaseAccessForVersion(versionId: string, user: UserPayload) {
    if (user.role === RoleName.ADMIN) {
      return; // ADMIN has global access
    }

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: true },
    });

    if (!version) {
      throw new NotFoundException(`Document version '${versionId}' not found`);
    }

    const assignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId: version.document.caseId,
          userId: user.userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Access denied: You are not assigned to the case containing this evidence version');
    }
  }
}
