import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [PrismaModule, AuthModule, CasesModule, DocumentsModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
