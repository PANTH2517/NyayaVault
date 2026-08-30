import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentClassification } from '@prisma/client';

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
}
