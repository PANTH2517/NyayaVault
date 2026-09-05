import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';
import { DocumentAccessGuard } from './guards/document-access.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * GET /api/v1/documents/search
   * Search and filter documents with CBAC authorization & pagination
   * MUST BE DECLARED BEFORE @Get('documents/:id') TO PREVENT PARSE AS DOCUMENT ID
   */
  @Get('documents/search')
  async searchDocuments(
    @Query() query: SearchDocumentsDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.searchDocuments(user, query);
  }

  /**
   * POST /api/v1/cases/:caseId/documents
   * Multipart upload initial document (v1) for case
   */
  @Post('cases/:caseId/documents')
  @UseGuards(CaseAccessGuard)
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
   * POST /api/v1/documents/:id/versions
   * Upload new immutable document revision (v2, v3, etc.)
   */
  @Post('documents/:id/versions')
  @UseGuards(DocumentAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async createVersion(
    @Param('id') documentId: string,
    @Body('changeDescription') changeDescription: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.createVersion(documentId, changeDescription, file, user);
  }

  /**
   * GET /api/v1/documents/:id/versions/:versionId/download
   * Automatic SHA-256 integrity verification and secure file download
   */
  @Get('documents/:id/versions/:versionId/download')
  @UseGuards(DocumentAccessGuard)
  async downloadVersion(
    @Param('id') documentId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: UserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const download = await this.documentsService.downloadVersionWithIntegrityCheck(
      documentId,
      versionId,
      user,
    );

    res.setHeader('Content-Type', download.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    res.setHeader('X-Document-SHA256', download.sha256Hash);
    res.send(download.buffer);
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

  /**
   * POST /api/v1/documents/:id/submit-for-review
   * Submit document for review (DRAFT -> UNDER_REVIEW)
   */
  @Post('documents/:id/submit-for-review')
  @UseGuards(DocumentAccessGuard)
  @HttpCode(HttpStatus.OK)
  async submitForReview(
    @Param('id') documentId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.submitForReview(documentId, user);
  }

  /**
   * POST /api/v1/documents/:id/approve
   * Approve document for specific version (UNDER_REVIEW -> APPROVED)
   */
  @Post('documents/:id/approve')
  @UseGuards(DocumentAccessGuard)
  @HttpCode(HttpStatus.OK)
  async approveDocument(
    @Param('id') documentId: string,
    @Body() dto: ApproveDocumentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.approveDocument(documentId, dto, user);
  }

  /**
   * POST /api/v1/documents/:id/seal
   * Seal approved document (APPROVED -> SEALED)
   */
  @Post('documents/:id/seal')
  @UseGuards(DocumentAccessGuard)
  @HttpCode(HttpStatus.OK)
  async sealDocument(
    @Param('id') documentId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.documentsService.sealDocument(documentId, user);
  }

  /**
   * GET /api/v1/documents/:id/approvals
   * Get approval history for document
   */
  @Get('documents/:id/approvals')
  @UseGuards(DocumentAccessGuard)
  async getApprovalsForDocument(@Param('id') documentId: string) {
    return this.documentsService.getApprovalsForDocument(documentId);
  }
}
