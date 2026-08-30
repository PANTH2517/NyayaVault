import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName, DocumentClassification, DocumentStatus } from '@prisma/client';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  /**
   * Secure Document Upload Workflow:
   * Auth Check -> Role Permission -> CBAC Check -> File Validation ->
   * SHA-256 Hashing -> Supabase Storage Upload -> DB Transaction -> Error Rollback Cleanup
   */
  async uploadDocument(
    caseId: string,
    uploadDto: UploadDocumentDto,
    file: Express.Multer.File,
    user: UserPayload,
  ) {
    // 1. Verify Case Existence
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
    });
    if (!caseRecord) {
      throw new NotFoundException(`Case with ID '${caseId}' not found`);
    }

    // 2. Validate Upload Authorization
    await this.validateUploadPermissions(caseId, user);

    // 3. Server-side File Validation
    this.validateFile(file);

    // 4. Server-side SHA-256 Hash Computation from raw file bytes
    const sha256Hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 5. Generate controlled IDs and storage path
    const documentId = crypto.randomUUID();
    const generatedFileId = crypto.randomUUID();
    const versionNumber = 1;
    const storagePath = `cases/${caseId}/documents/${documentId}/versions/${versionNumber}/${generatedFileId}`;

    // 6. Upload file bytes to private Supabase Storage
    await this.storageService.uploadFile(storagePath, file.buffer, file.mimetype);

    // 7. Persist Document & DocumentVersion in Prisma Transaction with failure cleanup
    try {
      return await this.prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            id: documentId,
            caseId,
            title: uploadDto.title,
            documentType: uploadDto.documentType,
            classification: uploadDto.classification || DocumentClassification.CONFIDENTIAL,
            currentStatus: DocumentStatus.DRAFT,
            createdById: user.userId,
          },
        });

        const version = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: 1,
            storagePath,
            fileSizeBytes: BigInt(file.size),
            mimeType: file.mimetype,
            sha256Hash,
            createdById: user.userId,
          },
        });

        await tx.document.update({
          where: { id: document.id },
          data: { currentVersionId: version.id },
        });

        return {
          document,
          version: {
            ...version,
            fileSizeBytes: version.fileSizeBytes.toString(),
          },
        };
      });
    } catch (dbError: any) {
      this.logger.error(`Database transaction failed during upload. Initiating storage cleanup for path '${storagePath}'`);
      // Cleanup uploaded object from Supabase Storage on DB failure
      await this.storageService.deleteFile(storagePath);
      throw new BadRequestException(`Document creation failed: ${dbError.message}`);
    }
  }

  /**
   * Find all documents for a case (Protected by CBAC)
   */
  async findAllForCase(caseId: string) {
    const documents = await this.prisma.document.findMany({
      where: { caseId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((doc) => ({
      ...doc,
      versions: doc.versions.map((v) => ({
        ...v,
        fileSizeBytes: v.fileSizeBytes.toString(),
      })),
    }));
  }

  /**
   * Find single document metadata (Protected by DocumentAccessGuard)
   */
  async findOne(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    return {
      ...document,
      versions: document.versions.map((v) => ({
        ...v,
        fileSizeBytes: v.fileSizeBytes.toString(),
      })),
    };
  }

  /**
   * Find all immutable versions for a document
   */
  async findVersionsForDocument(documentId: string) {
    await this.findOne(documentId); // Verify existence

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true, role: true } },
      },
      orderBy: { versionNumber: 'asc' },
    });

    return versions.map((v) => ({
      ...v,
      fileSizeBytes: v.fileSizeBytes.toString(),
    }));
  }

  /**
   * Enforce Role-Specific Upload Permissions & CBAC
   */
  private async validateUploadPermissions(caseId: string, user: UserPayload) {
    if (user.role === RoleName.SUPERVISOR || user.role === RoleName.PROSECUTOR) {
      throw new ForbiddenException(
        `Role '${user.role}' is not permitted to upload new investigation documents`
      );
    }

    if (user.role === RoleName.ADMIN) {
      return; // ADMIN has global upload access
    }

    if (user.role === RoleName.INVESTIGATING_OFFICER) {
      const assignment = await this.prisma.caseAssignment.findUnique({
        where: {
          caseId_userId: {
            caseId,
            userId: user.userId,
          },
        },
      });

      if (!assignment) {
        throw new ForbiddenException('Access denied: You are not assigned to this case');
      }
    }
  }

  /**
   * Enforce File Validation Rules (MIME type, Size, Non-empty)
   */
  private validateFile(file: Express.Multer.File) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Uploaded file cannot be empty');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size (${file.size} bytes) exceeds maximum limit of ${MAX_FILE_SIZE_BYTES} bytes (25MB)`
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File MIME type '${file.mimetype}' is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }
  }
}
