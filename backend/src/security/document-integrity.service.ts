import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../documents/supabase-storage.service';
import { DocumentEncryptionService } from '../documents/document-encryption.service';

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
    private readonly encryptionService: DocumentEncryptionService,
  ) {}

  /**
   * Byte-level SHA-256 integrity verification against trusted database hash
   * Decrypts AES-256-GCM storage envelope before computing plaintext SHA-256
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
      // 1. Fetch storage object bytes from private Supabase storage
      const fileBuffer = await this.storageService.downloadFileBytes(version.storagePath);

      // 2. Decrypt AES-256-GCM envelope (or retain legacy plaintext)
      let plaintextBuffer: Buffer;
      try {
        const decResult = this.encryptionService.decryptDocumentBytes(fileBuffer, version.isEncrypted ?? false);
        plaintextBuffer = decResult.plaintext;
      } catch (decErr: any) {
        this.logger.error(
          `Ciphertext authentication/decryption failure for version '${versionId}': ${decErr.message}`,
        );
        return {
          valid: false,
          tampered: true,
          documentId,
          versionId,
          versionNumber: version.versionNumber,
          expectedHash,
          actualHash: 'CIPHERTEXT_AUTHENTICATION_TAG_MISMATCH',
          checkedAt,
          error: 'CIPHERTEXT_AUTHENTICATION_FAILED',
        };
      }

      // 3. Compute actual SHA-256 hash from decrypted plaintext bytes
      const actualHash = crypto.createHash('sha256').update(plaintextBuffer).digest('hex');

      // 4. Timing-safe comparison of SHA-256 hashes against database trusted hash
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
        `TAMPER DETECTED! Document '${documentId}' version '${version.versionNumber}' (Path: '${version.storagePath}'). Expected: ${expectedHash}, Actual: ${actualHash}`,
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
