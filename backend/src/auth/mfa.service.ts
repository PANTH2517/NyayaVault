/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/auth/mfa.service.ts
 *
 * Sub-Phase 1I: Real TOTP Multi-Factor Authentication & Cryptographic Utilities
 */

import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

export interface TotpVerificationResult {
  valid: boolean;
  timeStep?: number;
  isReplay?: boolean;
  error?: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Encryption key resolver (32 bytes required for AES-256-GCM)
   */
  private getEncryptionKey(): Buffer {
    const rawKey = process.env.MFA_ENCRYPTION_KEY;
    if (!rawKey || rawKey.length < 32) {
      throw new Error('MFA_ENCRYPTION_KEY must be a valid 32-byte key.');
    }
    return Buffer.from(rawKey.slice(0, 32), 'utf-8');
  }

  /**
   * Secret for short-lived MFA challenge tokens
   */
  private getChallengeSecret(): string {
    return process.env.MFA_CHALLENGE_SECRET || process.env.JWT_SECRET || 'dev_mfa_challenge_secret_key_2026';
  }

  /**
   * Encrypt plaintext TOTP secret with AES-256-GCM (Returns v1:iv:tag:ciphertext)
   */
  encryptSecret(plainSecret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainSecret, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt AES-256-GCM encrypted TOTP secret
   */
  decryptSecret(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length === 4 && parts[0] === 'v1') {
        parts.shift();
      }
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted MFA format');
      }

      const [ivHex, authTagHex, ciphertextHex] = parts;
      const key = this.getEncryptionKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch (err: any) {
      this.logger.error(`Failed to decrypt MFA secret: ${err.message}`);
      throw new UnauthorizedException('Authentication secret decryption failed');
    }
  }

  /**
   * Generate RFC 6238-compliant random Base32 TOTP secret (20 bytes = 160 bits)
   */
  generateTotpSecret(): string {
    const buffer = crypto.randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Encode Buffer to Base32 string (RFC 4648)
   */
  base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decode Base32 string to Buffer
   */
  base32Decode(base32Str: string): Buffer {
    const cleaned = base32Str.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Calculate 6-digit TOTP code for a secret and timestep (RFC 6238 / RFC 4226)
   */
  generateTotpCode(secretBase32: string, timeStep?: number): string {
    const step = timeStep ?? Math.floor(Date.now() / 1000 / 30);
    const key = this.base32Decode(secretBase32);

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(step, 4);

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;

    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString();
    return otp.padStart(6, '0');
  }

  /**
   * Verify TOTP code over allowable window [-1, 0, +1] with replay check
   */
  verifyTotpCode(
    secretBase32: string,
    inputCode: string,
    lastUsedTimeStep?: number | null
  ): TotpVerificationResult {
    const sanitizedCode = (inputCode || '').trim();
    if (!/^\d{6}$/.test(sanitizedCode)) {
      return { valid: false, error: 'INVALID_FORMAT' };
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const windowSteps = [currentStep - 1, currentStep, currentStep + 1];

    for (const step of windowSteps) {
      const validCode = this.generateTotpCode(secretBase32, step);

      if (sanitizedCode === validCode) {
        // Replay check: reject if timeStep has already been accepted
        if (lastUsedTimeStep !== undefined && lastUsedTimeStep !== null && step <= lastUsedTimeStep) {
          return { valid: false, timeStep: step, isReplay: true, error: 'CODE_REPLAYED' };
        }
        return { valid: true, timeStep: step };
      }
    }

    return { valid: false, error: 'INVALID_CODE' };
  }

  /**
   * Generate 8 single-use emergency recovery codes with 128 bits of entropy (e.g. XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX)
   */
  async generateRecoveryCodes(count = 8): Promise<{ plainCodes: string[]; hashedCodes: string[] }> {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(4).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(4).toString('hex').toUpperCase();
      const part3 = crypto.randomBytes(4).toString('hex').toUpperCase();
      const part4 = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `${part1}-${part2}-${part3}-${part4}`;

      plainCodes.push(code);
      const codeHash = await argon2.hash(code);
      hashedCodes.push(codeHash);
    }

    return { plainCodes, hashedCodes };
  }

  /**
   * Verify single recovery code against Argon2 hash
   */
  async verifyRecoveryCode(plainCode: string, hashedCode: string): Promise<boolean> {
    try {
      const sanitized = plainCode.trim().toUpperCase();
      return await argon2.verify(hashedCode, sanitized);
    } catch {
      return false;
    }
  }

  /**
   * Build otpauth:// URI for authenticator app QR code generation
   */
  buildOtpAuthUrl(email: string, secretBase32: string, issuer = 'NyayaVault'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  generateOtpauthUrl(email: string, secretBase32: string, issuer = 'NyayaVault'): string {
    return this.buildOtpAuthUrl(email, secretBase32, issuer);
  }

  /**
   * Issue short-lived MFA challenge JWT token
   */
  async generateMfaChallengeToken(userId: string, expiresSeconds = 300): Promise<string> {
    const payload = {
      sub: userId,
      purpose: 'MFA_LOGIN',
      jti: crypto.randomUUID(),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getChallengeSecret(),
      expiresIn: expiresSeconds > 0 ? `${expiresSeconds}s` : '-1s',
    });
  }

  /**
   * Issue short-lived (10m) restricted MFA enrollment token for policy enforcement
   */
  async generateMfaEnrollmentToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      purpose: 'MFA_ENROLLMENT_REQUIRED',
      jti: crypto.randomUUID(),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getChallengeSecret(),
      expiresIn: '10m',
    });
  }

  /**
   * Verify MFA challenge JWT token
   */
  async verifyMfaChallengeToken(token: string): Promise<{ sub: string; purpose: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.getChallengeSecret(),
      });

      if (!payload.sub || (payload.purpose !== 'MFA_LOGIN' && payload.purpose !== 'MFA_ENROLLMENT_REQUIRED')) {
        throw new UnauthorizedException('Invalid or expired MFA challenge token');
      }

      return payload;
    } catch (err: any) {
      throw new UnauthorizedException('Invalid or expired MFA challenge token');
    }
  }
}
