import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, UserPayload } from './decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  // --------------------------------------------------------
  // RBAC Demonstration & Verification Test Endpoints
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
