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

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
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
          upsert: false,
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
   * Check if file exists in mock storage (Used in unit tests)
   */
  hasMockFile(storagePath: string): boolean {
    return this.mockStorageMap.has(storagePath);
  }
}
