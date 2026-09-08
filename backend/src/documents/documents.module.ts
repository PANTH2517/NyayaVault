import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { DocumentAccessGuard } from './guards/document-access.guard';
import { AuthModule } from '../auth/auth.module';
import { CasesModule } from '../cases/cases.module';
import { BlockchainIntegrationModule } from '../blockchain/integration/blockchain-integration.module';

import { DocumentEncryptionService } from './document-encryption.service';

@Module({
  imports: [AuthModule, CasesModule, BlockchainIntegrationModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    SupabaseStorageService,
    DocumentEncryptionService,
    DocumentAccessGuard,
  ],
  exports: [
    DocumentsService,
    SupabaseStorageService,
    DocumentEncryptionService,
    DocumentAccessGuard,
  ],
})
export class DocumentsModule {}
