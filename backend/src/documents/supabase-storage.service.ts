import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabaseClient: SupabaseClient | null = null;
  private readonly bucketName: string;
  private readonly mockStorageMap = new Map<string, { buffer: Buffer; mimeType: string }>();

  constructor() {
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'nyayavault-documents';
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && process.env.NODE_ENV !== 'test') {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      this.logger.log(`Initialized Supabase Storage Client for bucket '${this.bucketName}'`);
    } else {
      this.logger.warn(
        `Supabase URL/Key unconfigured or set to placeholder. Using mock in-memory storage fallback for local execution.`
      );
    }
  }

  /**
   * Upload file buffer to private Supabase Storage bucket
   */
  async uploadFile(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.storage
        .from(this.bucketName)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        this.logger.error(`Supabase storage upload error for path '${storagePath}': ${error.message}`);
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      return data.path;
    }

    // In-memory fallback for local development / offline testing
    this.mockStorageMap.set(storagePath, { buffer, mimeType });
    this.logger.debug(`[Mock Storage] Uploaded object to '${storagePath}' (${buffer.length} bytes)`);
    return storagePath;
  }

  /**
   * Delete object from storage bucket (Used for transactional failure rollback cleanup)
   */
  async deleteFile(storagePath: string): Promise<void> {
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        this.logger.error(`Failed to cleanup storage object '${storagePath}': ${error.message}`);
      } else {
        this.logger.log(`Successfully cleaned up storage object '${storagePath}'`);
      }
      return;
    }

    // Fallback mock deletion
    this.mockStorageMap.delete(storagePath);
    this.logger.debug(`[Mock Storage] Deleted object from '${storagePath}'`);
  }

  /**
   * Download raw file bytes from storage for SHA-256 integrity verification
   */
  async downloadFileBytes(storagePath: string): Promise<Buffer> {
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.storage
        .from(this.bucketName)
        .download(storagePath);

      if (error || !data) {
        this.logger.error(`Failed to download storage object '${storagePath}': ${error?.message}`);
        throw new Error(`Storage object missing or unreadable: ${error?.message || 'No data'}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // In-memory mock fallback
    const item = this.mockStorageMap.get(storagePath);
    if (!item) {
      throw new Error(`Storage object missing at path '${storagePath}'`);
    }
    return item.buffer;
  }

  /**
   * Check if file exists in mock storage (Used in unit tests)
   */
  hasMockFile(storagePath: string): boolean {
    return this.mockStorageMap.has(storagePath);
  }

  /**
   * Helper to simulate byte tampering in unit tests
   */
  mutateMockFileBytes(storagePath: string, tamperedBuffer: Buffer) {
    const item = this.mockStorageMap.get(storagePath);
    if (item) {
      item.buffer = tamperedBuffer;
    }
  }

  /**
   * Controlled hackathon demo helper to simulate byte tampering in storage
   */
  async simulateTamperInStorage(storagePath: string): Promise<void> {
    const tamperedBuffer = Buffer.from(`TAMPERED_MALICIOUS_BYTES_UNAUTHORIZED_ALTERATION_${Date.now()}`);
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.storage
        .from(this.bucketName)
        .upload(storagePath, tamperedBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (error) {
        this.logger.error(`Failed to mutate bytes in Supabase storage for path '${storagePath}': ${error.message}`);
        throw new Error(`Tamper simulation failed in Supabase: ${error.message}`);
      }
    } else {
      this.mockStorageMap.set(storagePath, { buffer: tamperedBuffer, mimeType: 'application/pdf' });
    }
    this.logger.warn(
      `[TAMPER SIMULATOR] Successfully mutated stored file bytes for path '${storagePath}' without altering database SHA-256 hash or audit records.`
    );
  }
}
