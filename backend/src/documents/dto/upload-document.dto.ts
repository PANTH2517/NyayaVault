import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentClassification } from '@prisma/client';
import { normalizeTags, validateMetadataObject } from './update-document-metadata.dto';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Document title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Document type is required (e.g. FIR, CHARGE_SHEET, WITNESS_STATEMENT, EVIDENCE, FORENSIC_REPORT)' })
  documentType: string;

  @IsEnum(DocumentClassification, { message: 'Invalid document classification level' })
  @IsOptional()
  classification?: DocumentClassification;

  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(50, { message: 'Exhibit number cannot exceed 50 characters' })
  @IsOptional()
  exhibitNumber?: string;

  @IsArray({ message: 'Tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed per document' })
  @MaxLength(30, { each: true, message: 'Each tag cannot exceed 30 characters' })
  @Transform(({ value }) => normalizeTags(value))
  @IsOptional()
  tags?: string[];

  @IsObject({ message: 'Metadata must be a valid JSON object' })
  @Transform(({ value }) => validateMetadataObject(value))
  @IsOptional()
  metadata?: Record<string, any>;
}
