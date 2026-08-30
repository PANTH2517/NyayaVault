import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { DocumentAccessGuard } from './guards/document-access.guard';
import { AuthModule } from '../auth/auth.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [AuthModule, CasesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    SupabaseStorageService,
    DocumentAccessGuard,
  ],
  exports: [
    DocumentsService,
    SupabaseStorageService,
    DocumentAccessGuard,
  ],
})
export class DocumentsModule {}
