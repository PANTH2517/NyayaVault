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
import { PrismaLedgerStore } from '../ledger/prisma-ledger-store';

@Controller('api/v1/blockchain')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: BlockchainIntegrationService,
  ) {}

  /**
   * GET /api/v1/blockchain/status
   * Operational status of permissioned blockchain nodes & anchor counts
   */
  @Get('status')
  async getStatus(@CurrentUser() user: UserPayload) {
    const store = new PrismaLedgerStore({
      prisma: this.prisma as any,
      nodeId: 'POLICE_NODE',
    });

    const height = await store.getHeight();
    const latest = await store.getLatestBlock();

    const [totalAnchors, confirmedAnchors, pendingAnchors, failedAnchors] = await Promise.all([
      this.prisma.blockchainApplicationAnchor.count(),
      this.prisma.blockchainApplicationAnchor.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.blockchainApplicationAnchor.count({ where: { status: 'PENDING' } }),
      this.prisma.blockchainApplicationAnchor.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      nodeId: user.role === RoleName.ADMIN ? 'ADMIN_NODE' : 'POLICE_NODE',
      chainId: 'nyayavault-mainnet-1',
      currentHeight: height >= 0n ? height.toString() : '0',
      latestBlockHash: latest?.blockHash || null,
      lifecycleState: 'READY',
      peerConnectivity: {
        activeNodes: ['POLICE_NODE', 'PROSECUTION_NODE', 'COURT_NODE', 'ADMIN_NODE'],
        status: 'CONNECTED',
      },
      anchorSummary: {
        total: totalAnchors,
        confirmed: confirmedAnchors,
        pending: pendingAnchors,
        failed: failedAnchors,
      },
    };
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
