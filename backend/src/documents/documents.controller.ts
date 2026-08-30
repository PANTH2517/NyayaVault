import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';
import { DocumentAccessGuard } from './guards/document-access.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * POST /api/v1/cases/:caseId/documents
   * Multipart upload new document for case
   */
  @Post('cases/:caseId/documents')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @Param('caseId') caseId: string,
    @Body() uploadDto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.uploadDocument(caseId, uploadDto, file, user);
  }

  /**
   * GET /api/v1/cases/:caseId/documents
   * List documents for case (Protected by CBAC)
   */
  @Get('cases/:caseId/documents')
  @UseGuards(CaseAccessGuard)
  async findAllForCase(@Param('caseId') caseId: string) {
    return this.documentsService.findAllForCase(caseId);
  }

  /**
   * GET /api/v1/documents/:id
   * Get document metadata by ID (Protected by DocumentAccessGuard)
   */
  @Get('documents/:id')
  @UseGuards(DocumentAccessGuard)
  async findOne(@Param('id') documentId: string) {
    return this.documentsService.findOne(documentId);
  }

  /**
   * GET /api/v1/documents/:id/versions
   * Get version history for document (Protected by DocumentAccessGuard)
   */
  @Get('documents/:id/versions')
  @UseGuards(DocumentAccessGuard)
  async findVersionsForDocument(@Param('id') documentId: string) {
    return this.documentsService.findVersionsForDocument(documentId);
  }
}
