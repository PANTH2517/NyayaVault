/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/integrity-monitoring/integrity-monitoring.controller.ts
 *
 * Sub-Phase 1H: Advanced Tamper Monitoring & Real-Time Integrity Alerts Controller
 */

import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import { IntegrityMonitoringService, IntegrityMonitoringStatus, ScanExecutionResult } from './integrity-monitoring.service';

@Controller('api/v1/integrity-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrityMonitoringController {
  constructor(private readonly monitoringService: IntegrityMonitoringService) {}

  /**
   * GET /api/v1/integrity-monitoring/status
   * Fetch operational metrics for Continuous Scheduled Integrity Monitoring (ADMIN only)
   */
  @Get('status')
  @Roles(RoleName.ADMIN)
  getMonitoringStatus(): IntegrityMonitoringStatus {
    return this.monitoringService.getMonitoringStatus();
  }

  /**
   * POST /api/v1/integrity-monitoring/scan
   * Trigger immediate real integrity-monitoring scan (ADMIN only)
   * Invokes the exact same production monitoring engine logic.
   */
  @Post('scan')
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerIntegrityScan(): Promise<ScanExecutionResult> {
    return this.monitoringService.runIntegrityScan();
  }
}
