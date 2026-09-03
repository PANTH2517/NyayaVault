import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/admin/users
   * List all user accounts (ADMIN only)
   */
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  /**
   * GET /api/v1/admin/users/:id
   * Get single user account detail (ADMIN only)
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /api/v1/admin/users
   * Create new user account with assigned role & Argon2 password (ADMIN only)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  /**
   * PATCH /api/v1/admin/users/:id/role
   * Update user role (ADMIN only)
   */
  @Patch(':id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(id, dto);
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Activate or deactivate user account (ADMIN only).
   * Deactivation immediately revokes active sessions.
   */
  @Patch(':id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(id, dto);
  }
}
