import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService, COOKIE_NAME, getCookieOptions } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, UserPayload } from './decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Creates a pending registration request for ADMIN review.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() registerDto: RegisterRequestDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  /**
   * POST /api/v1/auth/login
   * Authenticates credentials, generates tokens, and sets HTTP-only refresh cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    // Set HTTP-only refresh token cookie
    res.cookie(COOKIE_NAME, result.refreshToken, getCookieOptions());

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * POST /api/v1/auth/refresh
   * Rotates refresh session using HTTP-only cookie and sets new refresh cookie.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Read refresh token from cookies first, fallback to body if provided
    const refreshToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshTokens(refreshToken, ipAddress, userAgent);

    // Set new rotated HTTP-only refresh token cookie
    res.cookie(COOKIE_NAME, result.refreshToken, getCookieOptions());

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * POST /api/v1/auth/logout
   * Revokes current refresh session in DB and clears HTTP-only cookie.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[COOKIE_NAME];

    const result = await this.authService.logout(userId, refreshToken);

    // Clear HTTP-only cookie
    const options = getCookieOptions();
    res.clearCookie(COOKIE_NAME, {
      path: options.path,
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
    });

    return result;
  }

  /**
   * POST /api/v1/auth/change-password
   * Allows authenticated user to update their account password
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    return this.authService.changePassword(userId, dto, refreshToken);
  }

  /**
   * POST /api/v1/auth/password-reset/request
   * Initiates password recovery flow (Generic response for account enumeration protection)
   */
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  /**
   * POST /api/v1/auth/password-reset/confirm
   * Completes password reset using cryptographically hashed token
   */
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  /**
   * GET /api/v1/auth/me
   * Fetches current authenticated user profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  // --------------------------------------------------------
  // RBAC Verification Test Endpoints
  // --------------------------------------------------------

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  getAdminOnlyResource(@CurrentUser() user: UserPayload) {
    return {
      message: 'Access granted to ADMIN resource',
      user,
    };
  }

  @Get('supervisor-or-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPERVISOR)
  getSupervisorOrAdminResource(@CurrentUser() user: UserPayload) {
    return {
      message: 'Access granted to SUPERVISOR/ADMIN resource',
      user,
    };
  }

  @Get('investigator-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.INVESTIGATING_OFFICER)
  getInvestigatorResource(@CurrentUser() user: UserPayload) {
    return {
      message: 'Access granted to INVESTIGATING_OFFICER resource',
      user,
    };
  }
}
