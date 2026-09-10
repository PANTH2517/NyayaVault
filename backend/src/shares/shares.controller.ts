import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { AccessShareDto } from './dto/access-share.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('api/v1')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /**
   * POST /api/v1/shares
   * Create time-bound evidence share
   */
  @Post('shares')
  @UseGuards(JwtAuthGuard)
  async createShare(
    @Body() dto: CreateShareDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.sharesService.createShare(dto, user);
  }

  /**
   * GET /api/v1/shares/version/:versionId
   * List historical & active shares for a version (No raw tokens exposed)
   */
  @Get('shares/version/:versionId')
  @UseGuards(JwtAuthGuard)
  async getSharesForVersion(
    @Param('versionId') versionId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.sharesService.getSharesForVersion(versionId, user);
  }

  /**
   * DELETE /api/v1/shares/:shareId
   * Revoke an active evidence share
   */
  @Delete('shares/:shareId')
  @UseGuards(JwtAuthGuard)
  async revokeShare(
    @Param('shareId') shareId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.sharesService.revokeShare(shareId, user);
  }

  /**
   * GET /api/v1/cases/:caseId/eligible-recipients
   * Fetch active case-assigned users eligible for recipient selection
   */
  @Get('cases/:caseId/eligible-recipients')
  @UseGuards(JwtAuthGuard)
  async getEligibleRecipients(
    @Param('caseId') caseId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.sharesService.getEligibleRecipientsForCase(caseId, user);
  }

  /**
   * POST /api/v1/shares/access
   * Redeem shared evidence via token in authenticated request body.
   * Rate limited: 10 requests / minute per IP/user.
   */
  @Post('shares/access')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async accessSharedEvidence(
    @Body() dto: AccessShareDto,
    @CurrentUser() user: UserPayload,
    @Res() res: Response,
  ) {
    const fileResult = await this.sharesService.accessSharedEvidence(dto.token, user);

    res.set({
      'Content-Type': fileResult.mimeType,
      'Content-Disposition': `attachment; filename="${fileResult.filename}"`,
      'Content-Length': fileResult.buffer.length,
      'X-Evidence-SHA256': fileResult.sha256Hash,
    });

    return res.send(fileResult.buffer);
  }
}
