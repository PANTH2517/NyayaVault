import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentClassification, DocumentStatus } from '@prisma/client';

export class SearchDocumentsDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsEnum(DocumentClassification, { message: 'Invalid classification filter' })
  @IsOptional()
  classification?: DocumentClassification;

  @IsEnum(DocumentStatus, { message: 'Invalid status filter' })
  @IsOptional()
  status?: DocumentStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
