import { Injectable, Logger, UnauthorizedException, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

export const NYEV_MAGIC = Buffer.from([0x4e, 0x59, 0x45, 0x56]); // "NYEV"
export const CURRENT_ENVELOPE_VERSION = 1;
export const DEFAULT_KEY_VERSION = 1;
export const HEADER_METADATA_SIZE = 8; // Magic (4) + envelopeVersion (1) + keyVersion (2) + reserved (1)
export const IV_SIZE = 12;
export const AUTH_TAG_SIZE = 16;
export const FIXED_HEADER_SIZE = HEADER_METADATA_SIZE + IV_SIZE + AUTH_TAG_SIZE; // 36 bytes

export interface EncryptionMetadata {
  version: number;
  keyVersion: number;
}

export interface DecryptionResult {
  plaintext: Buffer;
  isLegacyPlaintext: boolean;
  metadata: EncryptionMetadata;
}

@Injectable()
export class DocumentEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(DocumentEncryptionService.name);

  onModuleInit(): void {
    this.validateEncryptionKey();
  }

  /**
   * Validate that DOCUMENT_ENCRYPTION_KEY is present and exactly 32 bytes (256 bits).
   * Fail fast in production if invalid or missing.
   */
  public validateEncryptionKey(): void {
    const rawKey = this.getRawKeyFromEnv();
    if (!rawKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY environment variable must be configured in production.');
      } else {
        this.logger.warn('DOCUMENT_ENCRYPTION_KEY is unconfigured in development. Using development key fallback.');
      }
    } else {
      const keyBuffer = Buffer.from(rawKey, 'utf-8');
      if (keyBuffer.length < 32) {
        throw new Error('FATAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY must be a valid 32-byte (256-bit) secret key.');
      }
    }
  }

  /**
   * Key Version Resolver: Maps keyVersion to a 32-byte key Buffer
   */
  private resolveKey(keyVersion: number): Buffer {
    if (keyVersion !== 1) {
      throw new BadRequestException(`UNSUPPORTED_KEY_VERSION: Key version ${keyVersion} is unknown or revoked.`);
    }

    const rawKey = this.getRawKeyFromEnv();
    if (rawKey && rawKey.length >= 32) {
      return Buffer.from(rawKey.slice(0, 32), 'utf-8');
    }

    // Development/test fallback key (32 bytes)
    const devKey = process.env.DOCUMENT_ENCRYPTION_KEY || 'dev_doc_encryption_key_32bytes!';
    if (devKey.length < 32) {
      return Buffer.alloc(32, devKey);
    }
    return Buffer.from(devKey.slice(0, 32), 'utf-8');
  }

  private getRawKeyFromEnv(): string | undefined {
    return process.env.DOCUMENT_ENCRYPTION_KEY;
  }

  /**
   * Check if a buffer starts with the NYEV binary magic header
   */
  public isEncryptedEnvelope(buffer: Buffer): boolean {
    if (!buffer || buffer.length < FIXED_HEADER_SIZE) {
      return false;
    }
    return buffer.subarray(0, 4).equals(NYEV_MAGIC);
  }

  /**
   * AES-256-GCM Authenticated Encryption with 36-byte NYEV Versioned Binary Envelope
   */
  public encryptDocumentBytes(
    plaintext: Buffer,
    keyVersion: number = DEFAULT_KEY_VERSION,
  ): { encryptedBuffer: Buffer; metadata: EncryptionMetadata } {
    if (!plaintext || plaintext.length === 0) {
      throw new BadRequestException('Cannot encrypt empty or null document buffer');
    }

    const key = this.resolveKey(keyVersion);
    const iv = crypto.randomBytes(IV_SIZE);

    // Build 8-byte Metadata Header: Magic (4) + EnvelopeVer (1) + KeyVer (2) + Reserved (1)
    const metadataHeader = Buffer.alloc(HEADER_METADATA_SIZE);
    NYEV_MAGIC.copy(metadataHeader, 0);
    metadataHeader.writeUInt8(CURRENT_ENVELOPE_VERSION, 4);
    metadataHeader.writeUInt16BE(keyVersion, 5);
    metadataHeader.writeUInt8(0x00, 7); // Reserved

    // Initialize AES-256-GCM cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(metadataHeader); // Authenticate header metadata with GCM AAD

    const ciphertextPart1 = cipher.update(plaintext);
    const ciphertextPart2 = cipher.final();
    const ciphertext = Buffer.concat([ciphertextPart1, ciphertextPart2]);
    const authTag = cipher.getAuthTag();

    // Assemble Full Binary Envelope: MetadataHeader (8) + IV (12) + AuthTag (16) + Ciphertext
    const encryptedBuffer = Buffer.concat([metadataHeader, iv, authTag, ciphertext]);

    return {
      encryptedBuffer,
      metadata: {
        version: CURRENT_ENVELOPE_VERSION,
        keyVersion,
      },
    };
  }

  /**
   * AES-256-GCM Authenticated Decryption & Envelope Validation
   */
  public decryptDocumentBytes(
    storedBuffer: Buffer,
    isEncryptedVersion: boolean = false,
  ): DecryptionResult {
    if (!storedBuffer || storedBuffer.length === 0) {
      throw new BadRequestException('Cannot decrypt empty or null document buffer');
    }

    const isEnvelope = this.isEncryptedEnvelope(storedBuffer);

    if (!isEnvelope) {
      if (isEncryptedVersion) {
        throw new UnauthorizedException(
          'MALFORMED_ENCRYPTION_ENVELOPE: Storage object is marked as encrypted in database but lacks valid NYEV header.',
        );
      }

      // Legacy unencrypted plaintext object
      return {
        plaintext: storedBuffer,
        isLegacyPlaintext: true,
        metadata: {
          version: 0,
          keyVersion: 0,
        },
      };
    }

    if (storedBuffer.length < FIXED_HEADER_SIZE) {
      throw new UnauthorizedException(
        'MALFORMED_ENCRYPTION_ENVELOPE: Truncated NYEV header (less than 36 bytes).',
      );
    }

    // Parse Envelope
    const metadataHeader = storedBuffer.subarray(0, HEADER_METADATA_SIZE);
    const envelopeVersion = metadataHeader.readUInt8(4);
    const keyVersion = metadataHeader.readUInt16BE(5);

    if (envelopeVersion !== CURRENT_ENVELOPE_VERSION) {
      throw new BadRequestException(
        `UNSUPPORTED_ENVELOPE_VERSION: Envelope version ${envelopeVersion} is not supported.`,
      );
    }

    const iv = storedBuffer.subarray(HEADER_METADATA_SIZE, HEADER_METADATA_SIZE + IV_SIZE);
    const authTag = storedBuffer.subarray(
      HEADER_METADATA_SIZE + IV_SIZE,
      HEADER_METADATA_SIZE + IV_SIZE + AUTH_TAG_SIZE,
    );
    const ciphertext = storedBuffer.subarray(FIXED_HEADER_SIZE);

    const key = this.resolveKey(keyVersion);

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(metadataHeader); // Authenticate header metadata with GCM AAD
      decipher.setAuthTag(authTag);

      const plaintextPart1 = decipher.update(ciphertext);
      const plaintextPart2 = decipher.final();
      const plaintext = Buffer.concat([plaintextPart1, plaintextPart2]);

      return {
        plaintext,
        isLegacyPlaintext: false,
        metadata: {
          version: envelopeVersion,
          keyVersion,
        },
      };
    } catch (err: any) {
      this.logger.error(`AES-256-GCM decipher authentication tag mismatch or corruption: ${err.message}`);
      throw new UnauthorizedException(
        'CIPHERTEXT_AUTHENTICATION_FAILED: Storage object authentication tag verification failed (ciphertext tampered or corrupted).',
      );
    }
  }
}
