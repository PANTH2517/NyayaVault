import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseAccessGuard } from './guards/case-access.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CaseAccessGuard],
  exports: [CasesService, CaseAccessGuard],
})
export class CasesModule {}
