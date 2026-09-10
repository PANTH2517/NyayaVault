import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';
import { DocumentsModule } from '../documents/documents.module';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SecurityModule,
    DocumentsModule,
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
