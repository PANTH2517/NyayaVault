/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/integrity-monitoring/integrity-monitoring.module.ts
 *
 * Sub-Phase 1H: Advanced Tamper Monitoring & Real-Time Integrity Alerts Module
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { DocumentsModule } from '../documents/documents.module';
import { BlockchainIntegrationModule } from '../blockchain/integration/blockchain-integration.module';
import { AuthModule } from '../auth/auth.module';
import { IntegrityMonitoringService } from './integrity-monitoring.service';
import { IntegrityMonitoringController } from './integrity-monitoring.controller';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    DocumentsModule,
    BlockchainIntegrationModule,
    AuthModule,
  ],
  controllers: [IntegrityMonitoringController],
  providers: [IntegrityMonitoringService],
  exports: [IntegrityMonitoringService],
})
export class IntegrityMonitoringModule {}
