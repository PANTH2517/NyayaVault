import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [PrismaModule, AuthModule, CasesModule, DocumentsModule, SecurityModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
