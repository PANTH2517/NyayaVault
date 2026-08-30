import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate user with email and password
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    const refreshTokenHash = await argon2.hash(tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Rotate access and refresh tokens using valid refresh token
   */
  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    let payload: any;
    try {
      const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_token_secret_for_local_testing_only';
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new UnauthorizedException('Access denied or token revoked');
    }

    const isRefreshTokenValid = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new rotated tokens
    const tokens = await this.generateTokens(user);
    const newRefreshTokenHash = await argon2.hash(tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Invalidate stored refresh token on logout
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { message: 'Logged out successfully' };
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
  private async generateTokens(user: User) {
    const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_for_local_testing_only';
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_token_secret_for_local_testing_only';
    const jwtExpiry = process.env.JWT_EXPIRATION || '15m';
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiry,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Exclude passwordHash and refreshTokenHash from user response
   */
  private sanitizeUser(user: User) {
    const { passwordHash, refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }
}
