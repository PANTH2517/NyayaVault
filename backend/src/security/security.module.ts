import { Module, Global } from '@nestjs/common';
import { AuditChainService } from './audit-chain.service';
import { DocumentIntegrityService } from './document-integrity.service';
import { SecurityIncidentsService } from './security-incidents.service';
import { SecurityController } from './security.controller';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';

@Global()
@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [SecurityController],
  providers: [
    AuditChainService,
    DocumentIntegrityService,
    SecurityIncidentsService,
  ],
  exports: [
    AuditChainService,
    DocumentIntegrityService,
    SecurityIncidentsService,
  ],
})
export class SecurityModule {}
