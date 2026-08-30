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
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { UserPayload } from '../auth/decorators/current-user.decorator';
import { AuditChainService } from '../security/audit-chain.service';
import { DocumentIntegrityService } from '../security/document-integrity.service';
import { SecurityIncidentsService } from '../security/security-incidents.service';
import {
  RoleName,
  DocumentClassification,
  DocumentStatus,
  AuditEventType,
  IncidentType,
  IncidentSeverity,
} from '@prisma/client';

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
    private readonly auditChainService: AuditChainService,
    private readonly integrityService: DocumentIntegrityService,
    private readonly incidentsService: SecurityIncidentsService,
  ) {}

  /**
   * Secure Initial Document Upload Workflow (v1)
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
      const result = await this.prisma.$transaction(async (tx) => {
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

      // 8. Record Hash-Chained Audit Event
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.DOCUMENT_UPLOADED,
        userId: user.userId,
        caseId,
        documentId,
        versionId: result.version.id,
        action: `Uploaded original document '${uploadDto.title}' (Version 1)`,
        metadata: {
          sha256Hash,
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
        },
      });

      return result;
    } catch (dbError: any) {
      this.logger.error(`Database transaction failed during upload. Initiating storage cleanup for path '${storagePath}'`);
      await this.storageService.deleteFile(storagePath);
      throw new BadRequestException(`Document creation failed: ${dbError.message}`);
    }
  }

  /**
   * Create New Immutable Document Revision (v2, v3, etc.)
   */
  async createVersion(
    documentId: string,
    changeDescription: string | undefined,
    file: Express.Multer.File,
    user: UserPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { case: true },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    if (document.currentStatus === DocumentStatus.SEALED) {
      throw new ForbiddenException('Cannot create a new revision for a SEALED document');
    }

    // Validate Revision Permissions (ADMIN or assigned INVESTIGATING_OFFICER)
    await this.validateUploadPermissions(document.caseId, user);

    // Validate File Rules
    this.validateFile(file);

    // Compute Server-side SHA-256 from raw bytes
    const sha256Hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Get latest version number
    const latestVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const generatedFileId = crypto.randomUUID();
    const storagePath = `cases/${document.caseId}/documents/${documentId}/versions/${nextVersionNumber}/${generatedFileId}`;

    // Upload new revision bytes to private Supabase Storage
    await this.storageService.uploadFile(storagePath, file.buffer, file.mimetype);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const newVersion = await tx.documentVersion.create({
          data: {
            documentId,
            versionNumber: nextVersionNumber,
            storagePath,
            fileSizeBytes: BigInt(file.size),
            mimeType: file.mimetype,
            sha256Hash,
            changeDescription: changeDescription || null,
            createdById: user.userId,
          },
        });

        await tx.document.update({
          where: { id: documentId },
          data: { currentVersionId: newVersion.id, currentStatus: DocumentStatus.DRAFT },
        });

        return {
          documentId,
          version: {
            ...newVersion,
            fileSizeBytes: newVersion.fileSizeBytes.toString(),
          },
        };
      });

      // Record Audit Event
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.DOCUMENT_VERSION_CREATED,
        userId: user.userId,
        caseId: document.caseId,
        documentId,
        versionId: result.version.id,
        action: `Created document revision Version ${nextVersionNumber}`,
        metadata: {
          versionNumber: nextVersionNumber,
          sha256Hash,
          fileSizeBytes: file.size,
          changeDescription,
        },
      });

      return result;
    } catch (dbError: any) {
      this.logger.error(`Database transaction failed creating version ${nextVersionNumber}. Cleaning storage '${storagePath}'`);
      await this.storageService.deleteFile(storagePath);
      throw new BadRequestException(`Document version creation failed: ${dbError.message}`);
    }
  }

  /**
   * Automatic Integrity Verification & Secure Download Access
   */
  async downloadVersionWithIntegrityCheck(
    documentId: string,
    versionId: string,
    user: UserPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.documentId !== documentId) {
      throw new NotFoundException(`Document version '${versionId}' for document '${documentId}' not found`);
    }

    // 1. Perform Byte-Level Integrity Verification
    const integrity = await this.integrityService.verifyDocumentVersionIntegrity(documentId, versionId);

    // 2. Handle Integrity Failure / Tamper Detection
    if (!integrity.valid || integrity.tampered) {
      // Record INTEGRITY_FAILED in audit chain
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.INTEGRITY_FAILED,
        userId: user.userId,
        caseId: document.caseId,
        documentId,
        versionId,
        action: `Integrity check FAILED for document '${document.title}' version ${version.versionNumber}`,
        metadata: {
          expectedHash: integrity.expectedHash,
          actualHash: integrity.actualHash,
          error: integrity.error,
        },
      });

      // Flag version as compromised in DB
      await this.prisma.documentVersion.update({
        where: { id: versionId },
        data: { isCompromised: true },
      });

      // Automatically create Security Incident (with deduplication)
      await this.incidentsService.createIncident({
        incidentType: IncidentType.DOCUMENT_TAMPER_DETECTED,
        severity: IncidentSeverity.CRITICAL,
        caseId: document.caseId,
        documentId,
        versionId,
        description: `SECURITY ALERT: Tamper detected for document '${document.title}' (Version ${version.versionNumber}). Expected SHA-256: ${integrity.expectedHash}, Actual: ${integrity.actualHash}`,
      });

      // BLOCK ACCESS
      throw new ForbiddenException('DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED');
    }

    // 3. Hash Matches: Record INTEGRITY_VERIFIED & DOCUMENT_DOWNLOADED in audit chain
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.INTEGRITY_VERIFIED,
      userId: user.userId,
      caseId: document.caseId,
      documentId,
      versionId,
      action: `Integrity verified successfully for document '${document.title}' version ${version.versionNumber}`,
      metadata: {
        sha256Hash: integrity.actualHash,
      },
    });

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.DOCUMENT_DOWNLOADED,
      userId: user.userId,
      caseId: document.caseId,
      documentId,
      versionId,
      action: `Downloaded document '${document.title}' version ${version.versionNumber}`,
    });

    // 4. Download file bytes securely
    const buffer = await this.storageService.downloadFileBytes(version.storagePath);

    return {
      filename: `${document.title}_v${version.versionNumber}`,
      mimeType: version.mimeType,
      fileSizeBytes: version.fileSizeBytes.toString(),
      sha256Hash: version.sha256Hash,
      buffer,
    };
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
      versions: (doc.versions || []).map((v) => ({
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
      versions: (document.versions || []).map((v) => ({
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
        `Role '${user.role}' is not permitted to upload or revise investigation documents`
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

  /**
   * Submit Document for Review (DRAFT -> UNDER_REVIEW)
   */
  async submitForReview(documentId: string, user: UserPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    // Validate access (ADMIN or assigned INVESTIGATING_OFFICER)
    await this.validateUploadPermissions(document.caseId, user);

    if (document.currentStatus !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit document for review from state '${document.currentStatus}'. Document must be in DRAFT state.`
      );
    }

    if (!document.currentVersionId) {
      throw new BadRequestException('Document has no active version to submit for review');
    }

    const versionId = document.currentVersionId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { currentStatus: DocumentStatus.UNDER_REVIEW },
      });

      const approval = await tx.approval.create({
        data: {
          documentId,
          versionId,
          requestedById: user.userId,
          status: DocumentStatus.UNDER_REVIEW,
        },
      });

      return approval;
    });

    // Record Audit Event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.DOCUMENT_STATUS_CHANGED,
      userId: user.userId,
      caseId: document.caseId,
      documentId,
      versionId,
      action: `Submitted document '${document.title}' for review (Bound Version ID: ${versionId})`,
      metadata: {
        previousStatus: DocumentStatus.DRAFT,
        newStatus: DocumentStatus.UNDER_REVIEW,
        versionId,
      },
    });

    return result;
  }

  /**
   * Approve Document Version (UNDER_REVIEW -> APPROVED)
   * Strictly bound to currentVersionId
   */
  async approveDocument(documentId: string, dto: ApproveDocumentDto, user: UserPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    // Enforce Approval RBAC (SUPERVISOR or ADMIN)
    if (user.role !== RoleName.SUPERVISOR && user.role !== RoleName.ADMIN) {
      throw new ForbiddenException(`Role '${user.role}' is not authorized to approve documents`);
    }

    if (user.role === RoleName.SUPERVISOR) {
      const assignment = await this.prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: document.caseId, userId: user.userId } },
      });
      if (!assignment) {
        throw new ForbiddenException('Access denied: You are not assigned to this case');
      }
    }

    if (document.currentStatus !== DocumentStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        `Cannot approve document in state '${document.currentStatus}'. Document must be UNDER_REVIEW.`
      );
    }

    // Version Binding Check: Must match exact version being reviewed
    if (dto.versionId !== document.currentVersionId) {
      throw new BadRequestException(
        `Approval version mismatch: Submitted version '${dto.versionId}' does not match current document version '${document.currentVersionId}'`
      );
    }

    // Find pending approval record
    const pendingApproval = await this.prisma.approval.findFirst({
      where: {
        documentId,
        versionId: dto.versionId,
        status: DocumentStatus.UNDER_REVIEW,
      },
      orderBy: { requestedAt: 'desc' },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let updatedApproval;
      if (pendingApproval) {
        updatedApproval = await tx.approval.update({
          where: { id: pendingApproval.id },
          data: {
            status: DocumentStatus.APPROVED,
            approvedById: user.userId,
            decidedAt: new Date(),
            comments: dto.comments || null,
          },
        });
      } else {
        updatedApproval = await tx.approval.create({
          data: {
            documentId,
            versionId: dto.versionId,
            requestedById: user.userId,
            approvedById: user.userId,
            status: DocumentStatus.APPROVED,
            comments: dto.comments || null,
            decidedAt: new Date(),
          },
        });
      }

      await tx.document.update({
        where: { id: documentId },
        data: { currentStatus: DocumentStatus.APPROVED },
      });

      return updatedApproval;
    });

    // Record Audit Event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.DOCUMENT_APPROVED,
      userId: user.userId,
      caseId: document.caseId,
      documentId,
      versionId: dto.versionId,
      action: `Approved document '${document.title}' for bound Version ID: ${dto.versionId}`,
      metadata: {
        versionId: dto.versionId,
        comments: dto.comments,
      },
    });

    return result;
  }

  /**
   * Seal Approved Document (APPROVED -> SEALED)
   */
  async sealDocument(documentId: string, user: UserPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    if (user.role !== RoleName.ADMIN && user.role !== RoleName.SUPERVISOR) {
      throw new ForbiddenException(`Role '${user.role}' is not authorized to seal documents`);
    }

    if (user.role === RoleName.SUPERVISOR) {
      const assignment = await this.prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: document.caseId, userId: user.userId } },
      });
      if (!assignment) {
        throw new ForbiddenException('Access denied: You are not assigned to this case');
      }
    }

    if (document.currentStatus !== DocumentStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot seal document in state '${document.currentStatus}'. Document must be APPROVED.`
      );
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id: documentId },
      data: { currentStatus: DocumentStatus.SEALED },
    });

    // Record Audit Event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.DOCUMENT_STATUS_CHANGED,
      userId: user.userId,
      caseId: document.caseId,
      documentId,
      versionId: document.currentVersionId || undefined,
      action: `Sealed document '${document.title}'`,
      metadata: {
        previousStatus: DocumentStatus.APPROVED,
        newStatus: DocumentStatus.SEALED,
      },
    });

    return updatedDocument;
  }

  /**
   * Get Approval History for Document
   */
  async getApprovalsForDocument(documentId: string) {
    const approvals = await this.prisma.approval.findMany({
      where: { documentId },
      include: {
        requestedBy: { select: { id: true, email: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, email: true, fullName: true, role: true } },
        version: { select: { id: true, versionNumber: true, sha256Hash: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return approvals;
  }

  /**
   * Search Documents with CBAC Authorization & Multi-Field Filtering
   */
  async searchDocuments(user: UserPayload, queryParams: SearchDocumentsDto) {
    const page = queryParams.page || 1;
    const limit = queryParams.limit || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    // 1. Authorization Filter (ADMIN sees all; Non-admin sees assigned cases)
    if (user.role !== RoleName.ADMIN) {
      whereClause.case = {
        assignments: {
          some: {
            userId: user.userId,
          },
        },
      };
    }

    // 2. Metadata Filters
    if (queryParams.caseId) {
      whereClause.caseId = queryParams.caseId;
    }

    if (queryParams.classification) {
      whereClause.classification = queryParams.classification;
    }

    if (queryParams.status) {
      whereClause.currentStatus = queryParams.status;
    }

    // 3. Search Query Keyword Filter
    if (queryParams.q && queryParams.q.trim() !== '') {
      const qStr = queryParams.q.trim();
      const existingCaseWhere = whereClause.case || {};

      whereClause.AND = [
        {
          OR: [
            { title: { contains: qStr, mode: 'insensitive' } },
            { documentType: { contains: qStr, mode: 'insensitive' } },
            { case: { caseNumber: { contains: qStr, mode: 'insensitive' } } },
            { case: { title: { contains: qStr, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where: whereClause,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where: whereClause }),
    ]);

    const formattedDocs = documents.map((doc) => ({
      ...doc,
      versions: (doc.versions || []).map((v) => ({
        ...v,
        fileSizeBytes: v.fileSizeBytes.toString(),
      })),
    }));

    return {
      data: formattedDocs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

