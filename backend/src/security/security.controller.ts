import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditChainService } from './audit-chain.service';
import { SecurityIncidentsService } from './security-incidents.service';
import { SupabaseStorageService } from '../documents/supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName, IncidentStatus } from '@prisma/client';
import { SimulateTamperDto } from './dto/simulate-tamper.dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(
    private readonly auditChainService: AuditChainService,
    private readonly incidentsService: SecurityIncidentsService,
    private readonly storageService: SupabaseStorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/v1/security/audit-events
   * Fetch audit trail events with role & CBAC filtering and optional date range
   */
  @Get('security/audit-events')
  async getAuditEvents(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditChainService.getAuditEventsForUser(user, startDate, endDate);
  }

  /**
   * POST /api/v1/security/audit-chain/verify
   * Re-verifies full cryptographic hash chain (ADMIN only)
   */
  @Post('security/audit-chain/verify')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyAuditChain() {
    return this.auditChainService.verifyChain();
  }

  /**
   * POST /api/v1/security/simulate-tamper
   * Controlled Hackathon Tamper Simulator (ADMIN only, guarded by TAMPER_SIMULATION_ENABLED env)
   * Alters ONLY stored file bytes in storage. Database SHA-256 and audit logs remain UNTOUCHED.
   */
  @Post('security/simulate-tamper')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async simulateTamper(@Body() dto: SimulateTamperDto) {
    const isEnabled = process.env.TAMPER_SIMULATION_ENABLED === 'true';
    if (!isEnabled) {
      throw new ForbiddenException(
        'Tamper simulation is disabled in environment configuration. Set TAMPER_SIMULATION_ENABLED=true in .env to enable.'
      );
    }

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: dto.versionId },
      include: { document: { select: { title: true } } },
    });

    if (!version) {
      throw new NotFoundException(`Document version with ID '${dto.versionId}' not found`);
    }

    // Mutate ONLY stored document bytes in Supabase / mock storage
    await this.storageService.simulateTamperInStorage(version.storagePath);

    return {
      success: true,
      message: `Storage bytes for document '${version.document.title}' (Version ${version.versionNumber}) mutated successfully. DB hash and audit logs remain unchanged. Next download or verification attempt will trigger an automatic TAMPER DETECTED security incident!`,
      versionId: dto.versionId,
      storagePath: version.storagePath,
      trustedDbHash: version.sha256Hash,
    };
  }

  /**
   * GET /api/v1/security-incidents
   * List security incidents for user (ADMIN receives all; non-admin receives assigned case incidents)
   */
  @Get('security-incidents')
  async findAllIncidents(@CurrentUser() user: UserPayload) {
    return this.incidentsService.findAllForUser(user);
  }

  /**
   * GET /api/v1/security-incidents/:id
   * Get incident detail (Protected by case assignment if non-admin)
   */
  @Get('security-incidents/:id')
  async findOneIncident(
    @Param('id') incidentId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.incidentsService.findOne(incidentId, user);
  }

  /**
   * PATCH /api/v1/security-incidents/:id
   * Update security incident status (ADMIN only)
   */
  @Patch('security-incidents/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  async updateIncidentStatus(
    @Param('id') incidentId: string,
    @Body('status') status: IncidentStatus,
  ) {
    return this.incidentsService.updateStatus(incidentId, status);
  }
}
