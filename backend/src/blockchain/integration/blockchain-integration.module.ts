/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-integration.module.ts
 *
 * NestJS Module Wiring for Blockchain Integration
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { BlockchainEventMapper } from './blockchain-event-mapper';
import { BlockchainTransactionBuilder } from './blockchain-transaction-builder';
import { BlockchainAnchorService } from './blockchain-anchor.service';
import { BlockchainVerificationService } from './blockchain-verification.service';
import { AuditCheckpointService } from './audit-checkpoint.service';
import { BlockchainIntegrationService } from './blockchain-integration.service';
import { BlockchainObservabilityService } from './blockchain-observability.service';
import { BlockchainController } from './blockchain.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BlockchainController],
  providers: [
    BlockchainEventMapper,
    BlockchainTransactionBuilder,
    BlockchainAnchorService,
    BlockchainVerificationService,
    AuditCheckpointService,
    BlockchainIntegrationService,
    BlockchainObservabilityService,
  ],
  exports: [BlockchainIntegrationService, BlockchainObservabilityService],
})
export class BlockchainIntegrationModule {}
