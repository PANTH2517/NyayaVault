import { Test, TestingModule } from '@nestjs/testing';
import { DocumentEncryptionService, NYEV_MAGIC, FIXED_HEADER_SIZE } from '../document-encryption.service';
import * as crypto from 'crypto';

describe('DocumentEncryptionService (AES-256-GCM Unit Suite)', () => {
  let service: DocumentEncryptionService;
  const originalEnvKey = process.env.DOCUMENT_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.DOCUMENT_ENCRYPTION_KEY = 'test_doc_encryption_key_32bytes!!';
  });

  afterAll(() => {
    if (originalEnvKey !== undefined) {
      process.env.DOCUMENT_ENCRYPTION_KEY = originalEnvKey;
    } else {
      delete process.env.DOCUMENT_ENCRYPTION_KEY;
    }
  });

  beforeEach(async () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = 'test_doc_encryption_key_32bytes!';
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentEncryptionService],
    }).compile();

    service = module.get<DocumentEncryptionService>(DocumentEncryptionService);
  });

  it('1. AES-256-GCM round trip successfully encrypts and decrypts evidence bytes', () => {
    const plaintext = Buffer.from('CONFIDENTIAL_COURT_EVIDENCE_PAYLOAD_v101');
    const { encryptedBuffer, metadata } = service.encryptDocumentBytes(plaintext);

    expect(metadata.version).toBe(1);
    expect(metadata.keyVersion).toBe(1);
    expect(encryptedBuffer.length).toBeGreaterThan(FIXED_HEADER_SIZE);
    expect(encryptedBuffer.subarray(0, 4)).toEqual(NYEV_MAGIC);

    const decrypted = service.decryptDocumentBytes(encryptedBuffer, true);
    expect(decrypted.isLegacyPlaintext).toBe(false);
    expect(decrypted.plaintext).toEqual(plaintext);
    expect(decrypted.plaintext.toString('utf-8')).toBe('CONFIDENTIAL_COURT_EVIDENCE_PAYLOAD_v101');
  });

  it('2. Enforces 32-byte (256-bit) key requirement', () => {
    expect(() => service.validateEncryptionKey()).not.toThrow();
  });

  it('3. Rejects invalid key sizes (< 32 bytes)', () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = 'too_short';
    const badService = new DocumentEncryptionService();
    expect(() => badService.validateEncryptionKey()).toThrow(/32-byte/);
    process.env.DOCUMENT_ENCRYPTION_KEY = 'test_doc_encryption_key_32bytes!!';
  });

  it('4. Guarantees 12-byte IV uniqueness across 100 consecutive encryptions', () => {
    const plaintext = Buffer.from('SAME_PLAINTEXT_PAYLOAD');
    const ivSet = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const { encryptedBuffer } = service.encryptDocumentBytes(plaintext);
      // IV is stored at bytes 8 to 20 in 36-byte header
      const ivHex = encryptedBuffer.subarray(8, 20).toString('hex');
      expect(ivSet.has(ivHex)).toBe(false);
      ivSet.add(ivHex);
    }
    expect(ivSet.size).toBe(100);
  });

  it('5. Rejects ciphertext tampering (GCM auth tag mismatch)', () => {
    const plaintext = Buffer.from('EVIDENCE_DATA');
    const { encryptedBuffer } = service.encryptDocumentBytes(plaintext);

    // Mutate 1 byte inside ciphertext region (after 36-byte header)
    const tampered = Buffer.from(encryptedBuffer);
    tampered[40] = tampered[40] ^ 0xff;

    expect(() => service.decryptDocumentBytes(tampered, true)).toThrow(/CIPHERTEXT_AUTHENTICATION_FAILED/);
  });

  it('6. Rejects header / AAD metadata tampering (keyVersion / envelopeVersion modification)', () => {
    const plaintext = Buffer.from('EVIDENCE_DATA');
    const { encryptedBuffer } = service.encryptDocumentBytes(plaintext);

    // Mutate keyVersion byte in header (byte 5)
    const tamperedHeader = Buffer.from(encryptedBuffer);
    tamperedHeader[5] = 0x99;

    expect(() => service.decryptDocumentBytes(tamperedHeader, true)).toThrow();
  });

  it('7. Rejects unknown key version (fail closed)', () => {
    const plaintext = Buffer.from('EVIDENCE_DATA');
    expect(() => service.encryptDocumentBytes(plaintext, 999)).toThrow(/UNSUPPORTED_KEY_VERSION/);
  });

  it('8. Rejects unsupported envelope version', () => {
    const plaintext = Buffer.from('EVIDENCE_DATA');
    const { encryptedBuffer } = service.encryptDocumentBytes(plaintext);

    // Set envelopeVersion byte (byte 4) to unsupported 2
    const tamperedVersion = Buffer.from(encryptedBuffer);
    tamperedVersion[4] = 2;

    expect(() => service.decryptDocumentBytes(tamperedVersion, true)).toThrow();
  });

  it('9. Rejects truncated envelope headers (< 36 bytes)', () => {
    const truncated = Buffer.concat([NYEV_MAGIC, Buffer.alloc(10)]);
    expect(() => service.decryptDocumentBytes(truncated, true)).toThrow(/MALFORMED_ENCRYPTION_ENVELOPE/);
  });

  it('10. Detects legacy unencrypted plaintext objects cleanly', () => {
    const legacyPlaintext = Buffer.from('LEGACY_UNENCRYPTED_DOCUMENT_BYTES');
    const res = service.decryptDocumentBytes(legacyPlaintext, false);

    expect(res.isLegacyPlaintext).toBe(true);
    expect(res.plaintext).toEqual(legacyPlaintext);
  });

  it('11. Preserves exact SHA-256 hash stability across encrypt and decrypt cycle', () => {
    const plaintext = Buffer.from('REPRODUCIBLE_SHA256_TEST_PAYLOAD');
    const originalHash = crypto.createHash('sha256').update(plaintext).digest('hex');

    const { encryptedBuffer } = service.encryptDocumentBytes(plaintext);

    // Verify storage object hash is DIFFERENT from plaintext hash
    const storageObjectHash = crypto.createHash('sha256').update(encryptedBuffer).digest('hex');
    expect(storageObjectHash).not.toEqual(originalHash);

    // Decrypt and verify plaintext hash equals original
    const decrypted = service.decryptDocumentBytes(encryptedBuffer, true);
    const decryptedHash = crypto.createHash('sha256').update(decrypted.plaintext).digest('hex');
    expect(decryptedHash).toBe(originalHash);
  });

  it('12. Valid 64-character hexadecimal key parses to exactly 32-byte key material and completes AES-256-GCM round trip', () => {
    const hex64Key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.DOCUMENT_ENCRYPTION_KEY = hex64Key;

    const hexService = new DocumentEncryptionService();
    expect(() => hexService.validateEncryptionKey()).not.toThrow();

    const plaintext = Buffer.from('EVIDENCE_ENCRYPTED_WITH_64_CHAR_HEX_KEY');
    const { encryptedBuffer } = hexService.encryptDocumentBytes(plaintext);

    const decrypted = hexService.decryptDocumentBytes(encryptedBuffer, true);
    expect(decrypted.plaintext.toString('utf-8')).toBe('EVIDENCE_ENCRYPTED_WITH_64_CHAR_HEX_KEY');
  });

  it('13. Rejects malformed keys and invalid key lengths strictly without silent truncation', () => {
    // 40-character invalid length
    process.env.DOCUMENT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef01234567';
    const badLengthService = new DocumentEncryptionService();
    expect(() => badLengthService.validateEncryptionKey()).toThrow(/32-byte secret key or a 64-character hexadecimal string/);

    // 64-character string containing non-hex characters
    process.env.DOCUMENT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg';
    const badHexService = new DocumentEncryptionService();
    expect(() => badHexService.validateEncryptionKey()).toThrow(/32-byte secret key or a 64-character hexadecimal string/);

    process.env.DOCUMENT_ENCRYPTION_KEY = 'test_doc_encryption_key_32bytes!!';
  });

  it('14. Guarantees error messages never expose secret key material', () => {
    const sensitiveKey = 'INVALID_SECRET_KEY_FORMAT_STRING_FOR_EXPOSURE_TEST_1234567';
    process.env.DOCUMENT_ENCRYPTION_KEY = sensitiveKey;

    const testService = new DocumentEncryptionService();
    expect(() => testService.validateEncryptionKey()).toThrowError(
      'FATAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY must be a valid 32-byte secret key or a 64-character hexadecimal string.',
    );
  });

  it('15. Preserves backward compatibility: decrypts ciphertext generated under legacy 32-char UTF-8 slice of 64-hex char key', () => {
    const hex64Key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const legacyDerivedKey = Buffer.from(hex64Key.slice(0, 32), 'utf-8');

    const plaintext = Buffer.from('LEGACY_EVIDENCE_ENCRYPTED_WITH_OLD_UTF8_SLICE');

    // Manually encrypt using the legacy derived key (32 bytes of raw UTF-8 string)
    const iv = crypto.randomBytes(12);
    const metadataHeader = Buffer.alloc(8);
    NYEV_MAGIC.copy(metadataHeader, 0);
    metadataHeader.writeUInt8(1, 4);
    metadataHeader.writeUInt16BE(1, 5);
    metadataHeader.writeUInt8(0x00, 7);

    const cipher = crypto.createCipheriv('aes-256-gcm', legacyDerivedKey, iv);
    cipher.setAAD(metadataHeader);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const legacyEncryptedBuffer = Buffer.concat([metadataHeader, iv, authTag, ciphertext]);

    // Now configure service with 64-char hex key and verify decryption succeeds via legacy fallback
    process.env.DOCUMENT_ENCRYPTION_KEY = hex64Key;
    const hardenedService = new DocumentEncryptionService();

    const decrypted = hardenedService.decryptDocumentBytes(legacyEncryptedBuffer, true);
    expect(decrypted.plaintext.toString('utf-8')).toBe('LEGACY_EVIDENCE_ENCRYPTED_WITH_OLD_UTF8_SLICE');

    process.env.DOCUMENT_ENCRYPTION_KEY = 'test_doc_encryption_key_32bytes!!';
  });
});

