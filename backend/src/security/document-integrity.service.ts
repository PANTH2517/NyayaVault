import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../documents/supabase-storage.service';

export interface IntegrityVerificationResult {
  valid: boolean;
  tampered: boolean;
  documentId: string;
  versionId: string;
  versionNumber: number;
  expectedHash: string;
  actualHash: string;
  checkedAt: string;
  error?: string;
}

@Injectable()
export class DocumentIntegrityService {
  private readonly logger = new Logger(DocumentIntegrityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  /**
   * Byte-level SHA-256 integrity verification against trusted database hash
   */
  async verifyDocumentVersionIntegrity(
    documentId: string,
    versionId: string,
  ): Promise<IntegrityVerificationResult> {
    const checkedAt = new Date().toISOString();

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { select: { id: true, caseId: true } } },
    });

    if (!version || version.documentId !== documentId) {
      throw new NotFoundException(`Document version '${versionId}' for document '${documentId}' not found`);
    }

    const expectedHash = version.sha256Hash;

    try {
      // 1. Fetch exact file bytes from private Supabase storage
      const fileBuffer = await this.storageService.downloadFileBytes(version.storagePath);

      // 2. Compute actual SHA-256 hash from downloaded bytes
      const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 3. Timing-safe comparison of SHA-256 hashes
      const isMatch = this.timingSafeEquals(actualHash, expectedHash);

      if (isMatch) {
        return {
          valid: true,
          tampered: false,
          documentId,
          versionId,
          versionNumber: version.versionNumber,
          expectedHash,
          actualHash,
          checkedAt,
        };
      }

      this.logger.error(
        `TAMPER DETECTED! Document '${documentId}' version '${version.versionNumber}' (Path: '${version.storagePath}'). Expected: ${expectedHash}, Actual: ${actualHash}`
      );

      return {
        valid: false,
        tampered: true,
        documentId,
        versionId,
        versionNumber: version.versionNumber,
        expectedHash,
        actualHash,
        checkedAt,
        error: 'BYTE_LEVEL_SHA256_MISMATCH',
      };
    } catch (err: any) {
      this.logger.error(`Storage retrieval failure for version '${versionId}': ${err.message}`);
      return {
        valid: false,
        tampered: true,
        documentId,
        versionId,
        versionNumber: version.versionNumber,
        expectedHash,
        actualHash: 'STORAGE_OBJECT_UNREADABLE_OR_MISSING',
        checkedAt,
        error: err.message,
      };
    }
  }

  /**
   * Helper for timing-safe string comparison
   */
  private timingSafeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
    } catch {
      return false;
    }
  }
}
