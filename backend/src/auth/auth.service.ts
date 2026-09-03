import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditChainService } from '../security/audit-chain.service';
import { EmailService } from '../email/email.service';
import { AuditEventType } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { User } from '@prisma/client';

export const COOKIE_NAME = 'nyaya_refresh_token';

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSiteEnv = process.env.COOKIE_SAME_SITE;

  const sameSite = (sameSiteEnv as 'lax' | 'strict' | 'none') || (isProduction ? 'strict' : 'lax');
  const secure = isProduction || sameSite === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditChainService: AuditChainService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.validateSecrets();
  }

  /**
   * Fail fast in production if required JWT secrets are missing or insecure
   */
  private validateSecrets() {
    if (process.env.NODE_ENV === 'production') {
      const jwtSecret = process.env.JWT_SECRET;
      const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

      if (!jwtSecret || jwtSecret.includes('dev_')) {
        throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be securely configured in production.');
      }
      if (!refreshSecret || refreshSecret.includes('dev_')) {
        throw new Error('FATAL SECURITY ERROR: REFRESH_TOKEN_SECRET must be securely configured in production.');
      }
    }
  }

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev_jwt_secret_key_for_local_testing_only';
  }

  private getRefreshSecret(): string {
    return process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_token_secret_for_local_testing_only';
  }

  /**
   * Authenticate user with email and password, creating a unique UserSession
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        action: 'LOGIN_FAILURE',
        ipAddress,
        userAgent,
        metadata: { emailAttempt: email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      await this.auditChainService.recordEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        action: 'LOGIN_FAILURE',
        ipAddress,
        userAgent,
        metadata: { emailAttempt: email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 1. Create session shell to retrieve sessionId
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'PENDING_HASH',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    // 2. Generate tokens embedding sid (sessionId)
    const tokens = await this.generateTokens(user, session.id);
    const refreshTokenHash = await argon2.hash(tokens.refreshToken);

    // 3. Store hashed refresh token in session
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    // 4. Record cryptographic audit event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Rotate access and refresh tokens using a valid UserSession
   */
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sid || !payload.sub) {
      throw new UnauthorizedException('Malformed refresh token payload');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session not found or user mismatch');
    }

    // Check if session has already been revoked or expired
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token session has been revoked or expired');
    }

    if (!session.user || !session.user.isActive) {
      throw new UnauthorizedException('User account is inactive or disabled');
    }

    // Verify token hash
    const isTokenValid = await argon2.verify(session.refreshTokenHash, refreshToken);
    if (!isTokenValid) {
      // Security measure: Revoke the session immediately if token verification fails
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 1. Revoke the old session (Rotation)
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // 2. Create new session for rotated token
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const newSession = await this.prisma.userSession.create({
      data: {
        userId: session.userId,
        refreshTokenHash: 'PENDING_HASH',
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent,
        expiresAt: newExpiresAt,
      },
    });

    // 3. Issue new tokens
    const tokens = await this.generateTokens(session.user, newSession.id);
    const newRefreshTokenHash = await argon2.hash(tokens.refreshToken);

    await this.prisma.userSession.update({
      where: { id: newSession.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(session.user),
    };
  }

  /**
   * Invalidate active session on logout
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.getRefreshSecret(),
        });
        if (payload.sid) {
          await this.prisma.userSession.updateMany({
            where: { id: payload.sid, userId },
            data: { revokedAt: new Date() },
          });
        }
      } catch (_) {
        await this.revokeAllUserSessions(userId);
      }
    } else {
      await this.revokeAllUserSessions(userId);
    }

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId,
      action: 'LOGOUT',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Authenticated Password Change
   */
  async changePassword(userId: string, dto: ChangePasswordDto, currentRefreshToken?: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or inactive');
    }

    const isCurrentValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all other active sessions for security
    let currentSid: string | null = null;
    if (currentRefreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync(currentRefreshToken, {
          secret: this.getRefreshSecret(),
        });
        currentSid = payload.sid || null;
      } catch (_) {}
    }

    if (currentSid) {
      await this.prisma.userSession.updateMany({
        where: {
          userId,
          id: { not: currentSid },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.revokeAllUserSessions(userId);
    }

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId,
      action: 'PASSWORD_CHANGED',
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Initiate Secure Password Reset Request (Generic response for account enumeration protection)
   */
  async requestPasswordReset(dto: PasswordResetRequestDto) {
    const genericResponse = {
      message: 'If an active account exists for this official email, password reset instructions will be sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Invalidate any previous unused tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate 256-bit cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await this.emailService.sendPasswordResetEmail(user.email, resetUrl);

    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
    });

    return genericResponse;
  }

  /**
   * Complete Password Reset using Hashed Token Verification
   */
  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (!resetRecord.user || !resetRecord.user.isActive) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // 1. Argon2 hash new password
    const passwordHash = await argon2.hash(dto.newPassword);

    // 2. Update user password
    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    // 3. Mark token used
    await this.prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // 4. Revoke ALL active sessions across all devices
    await this.revokeAllUserSessions(resetRecord.userId);

    // 5. Append audit event
    await this.auditChainService.recordEvent({
      eventType: AuditEventType.LOGIN,
      userId: resetRecord.userId,
      action: 'PASSWORD_RESET_COMPLETED',
    });

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }

  /**
   * Revoke all active sessions for a user (e.g. on account deactivation)
   */
  async revokeAllUserSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Get current authenticated user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User profile not found or inactive');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Helper to generate JWT access and refresh tokens
   */
  private async generateTokens(user: User, sessionId: string) {
    const jwtSecret = this.getJwtSecret();
    const refreshSecret = this.getRefreshSecret();
    const jwtExpiry = process.env.JWT_EXPIRATION || '15m';
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshPayload = {
      sub: user.id,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: jwtSecret,
        expiresIn: jwtExpiry,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Exclude passwordHash and refreshTokenHash from user response
   */
  sanitizeUser(user: User) {
    const { passwordHash, refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }
}
