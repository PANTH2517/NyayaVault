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

export interface ResolvedKeyMaterial {
  primaryKey: Buffer;
  legacyKey?: Buffer;
}

@Injectable()
export class DocumentEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(DocumentEncryptionService.name);

  onModuleInit(): void {
    this.validateEncryptionKey();
  }

  /**
   * Validate that DOCUMENT_ENCRYPTION_KEY is present and is a valid key format:
   * Either a 64-character hex string (producing 32 raw bytes / 256 bits)
   * or a 32-byte raw secret string.
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
      this.resolveKeyMaterialFromKeyString(rawKey);
    }
  }

  /**
   * Key Material Resolver: Converts a raw key string into a primary 32-byte Buffer
   * (and an optional legacy 32-byte Buffer for backward compatibility with hex-sliced legacy keys).
   */
  private resolveKeyMaterialFromKeyString(rawKey: string): ResolvedKeyMaterial {
    if (!rawKey) {
      throw new Error('FATAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY string is empty or missing.');
    }

    const trimmed = rawKey.trim();

    // Case 1: 64-character hexadecimal string -> 32 raw bytes (256 bits)
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      const primaryKey = Buffer.from(trimmed, 'hex');
      // Legacy compatibility key: in previous versions, rawKey.slice(0, 32) was UTF-8 encoded
      const legacyKey = Buffer.from(trimmed.slice(0, 32), 'utf-8');
      return { primaryKey, legacyKey };
    }

    // Case 2: Raw UTF-8 key string of 32 to 34 bytes (e.g. standard 32-byte secret key)
    const utf8Buffer = Buffer.from(rawKey, 'utf-8');
    if (utf8Buffer.length >= 32 && utf8Buffer.length <= 34) {
      return { primaryKey: utf8Buffer.subarray(0, 32) };
    }

    // Reject malformed / invalid key formats strictly
    throw new Error(
      'FATAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY must be a valid 32-byte secret key or a 64-character hexadecimal string.',
    );
  }

  /**
   * Key Version Resolver: Maps keyVersion to key material buffers
   */
  private resolveKeyMaterial(keyVersion: number): ResolvedKeyMaterial {
    if (keyVersion !== DEFAULT_KEY_VERSION) {
      throw new BadRequestException(`UNSUPPORTED_KEY_VERSION: Key version ${keyVersion} is unknown or revoked.`);
    }

    const rawKey = this.getRawKeyFromEnv();
    if (rawKey) {
      try {
        return this.resolveKeyMaterialFromKeyString(rawKey);
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw err;
        }
      }
    }

    // Development/test fallback key (guaranteed 32 bytes)
    const devKey = 'dev_doc_encryption_key_32bytes!!';
    return { primaryKey: Buffer.from(devKey.slice(0, 32), 'utf-8') };
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

    const { primaryKey } = this.resolveKeyMaterial(keyVersion);
    const iv = crypto.randomBytes(IV_SIZE);

    // Build 8-byte Metadata Header: Magic (4) + EnvelopeVer (1) + KeyVer (2) + Reserved (1)
    const metadataHeader = Buffer.alloc(HEADER_METADATA_SIZE);
    NYEV_MAGIC.copy(metadataHeader, 0);
    metadataHeader.writeUInt8(CURRENT_ENVELOPE_VERSION, 4);
    metadataHeader.writeUInt16BE(keyVersion, 5);
    metadataHeader.writeUInt8(0x00, 7); // Reserved

    // Initialize AES-256-GCM cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', primaryKey, iv);
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

    const { primaryKey, legacyKey } = this.resolveKeyMaterial(keyVersion);

    // Try primary key first
    try {
      const plaintext = this.performAesDecryption(primaryKey, iv, authTag, ciphertext, metadataHeader);
      return {
        plaintext,
        isLegacyPlaintext: false,
        metadata: { version: envelopeVersion, keyVersion },
      };
    } catch (primaryErr: any) {
      // If primary key decryption fails (e.g. auth tag mismatch) AND legacy fallback key is available, retry with legacy key
      if (legacyKey) {
        try {
          const plaintext = this.performAesDecryption(legacyKey, iv, authTag, ciphertext, metadataHeader);
          this.logger.warn('Decrypted document version using legacy hex-sliced encryption key fallback.');
          return {
            plaintext,
            isLegacyPlaintext: false,
            metadata: { version: envelopeVersion, keyVersion },
          };
        } catch (_) {
          // Both primary and legacy key failed
        }
      }

      this.logger.error(`AES-256-GCM decipher authentication tag mismatch or corruption: ${primaryErr.message}`);
      throw new UnauthorizedException(
        'CIPHERTEXT_AUTHENTICATION_FAILED: Storage object authentication tag verification failed (ciphertext tampered or corrupted).',
      );
    }
  }

  private performAesDecryption(
    key: Buffer,
    iv: Buffer,
    authTag: Buffer,
    ciphertext: Buffer,
    aadHeader: Buffer,
  ): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aadHeader);
    decipher.setAuthTag(authTag);

    const part1 = decipher.update(ciphertext);
    const part2 = decipher.final();
    return Buffer.concat([part1, part2]);
  }
}

