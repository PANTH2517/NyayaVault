import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuditChainService } from './audit-chain.service';
import { SecurityIncidentsService } from './security-incidents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName, IncidentStatus } from '@prisma/client';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(
    private readonly auditChainService: AuditChainService,
    private readonly incidentsService: SecurityIncidentsService,
  ) {}

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
