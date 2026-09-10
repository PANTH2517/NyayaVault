import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentClassification } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export function normalizeTags(value: any): string[] | any {
  if (!value) return value;
  let tagArray: any[] = value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        tagArray = parsed;
      } else {
        tagArray = value.split(',').map((s) => s.trim());
      }
    } catch (_) {
      tagArray = value.split(',').map((s) => s.trim());
    }
  }

  if (!Array.isArray(tagArray)) {
    return value; // let class-validator fail
  }

  const result: string[] = [];
  const seenLower = new Set<string>();

  for (const item of tagArray) {
    if (typeof item !== 'string') return value;
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Tags cannot be empty or blank strings');
    }
    if (trimmed.length > 30) {
      throw new BadRequestException(`Tag '${trimmed}' exceeds maximum length of 30 characters`);
    }
    const lower = trimmed.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      result.push(trimmed);
    }
  }

  if (result.length > 10) {
    throw new BadRequestException('Maximum 10 tags allowed per document');
  }

  return result;
}

export function validateMetadataObject(value: any): any {
  if (!value) return value;
  let parsedObj = value;

  if (typeof value === 'string') {
    try {
      parsedObj = JSON.parse(value);
    } catch (_) {
      throw new BadRequestException('Invalid JSON payload in metadata field');
    }
  }

  if (typeof parsedObj !== 'object' || parsedObj === null || Array.isArray(parsedObj)) {
    throw new BadRequestException('Metadata must be a valid JSON object');
  }

  const str = JSON.stringify(parsedObj);
  if (str.length > 50000) {
    throw new BadRequestException('Metadata object size exceeds maximum limit of 50KB');
  }

  return parsedObj;
}

export class UpdateDocumentMetadataDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  documentType?: string;

  @IsEnum(DocumentClassification, { message: 'Invalid document classification level' })
  @IsOptional()
  classification?: DocumentClassification;

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
