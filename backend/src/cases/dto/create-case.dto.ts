import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CaseStatus } from '@prisma/client';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty({ message: 'Case number is required' })
  caseNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Case title is required' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CaseStatus, { message: 'Invalid case status' })
  @IsOptional()
  status?: CaseStatus;
}
