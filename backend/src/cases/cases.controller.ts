import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CaseAccessGuard } from './guards/case-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('api/v1/cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  /**
   * GET /api/v1/cases
   * List cases enforcing backend database-level authorization filtering
   */
  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    return this.casesService.findAllForUser(user);
  }

  /**
   * GET /api/v1/cases/:id
   * Get single case details (Protected by CBAC guard)
   */
  @Get(':id')
  @UseGuards(CaseAccessGuard)
  async findOne(@Param('id') caseId: string) {
    return this.casesService.findOne(caseId);
  }

  /**
   * POST /api/v1/cases
   * Create new case (ADMIN only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  async create(
    @Body() createCaseDto: CreateCaseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.casesService.createCase(createCaseDto, userId);
  }

  /**
   * PATCH /api/v1/cases/:id
   * Update case details (Protected by CBAC guard)
   */
  @Patch(':id')
  @UseGuards(CaseAccessGuard)
  async update(
    @Param('id') caseId: string,
    @Body() updateCaseDto: UpdateCaseDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.casesService.updateCase(caseId, updateCaseDto, user);
  }

  /**
   * POST /api/v1/cases/:id/assignments
   * Assign user to case (ADMIN only)
   */
  @Post(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  async assignUser(
    @Param('id') caseId: string,
    @Body() assignUserDto: AssignUserDto,
  ) {
    return this.casesService.assignUser(caseId, assignUserDto);
  }

  /**
   * DELETE /api/v1/cases/:id/assignments/:userId
   * Remove user assignment from case (ADMIN only)
   */
  @Delete(':id/assignments/:userId')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeAssignment(
    @Param('id') caseId: string,
    @Param('userId') userId: string,
  ) {
    return this.casesService.removeAssignment(caseId, userId);
  }
}
