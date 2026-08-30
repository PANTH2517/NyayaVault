import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveDocumentDto {
  @IsString()
  @IsUUID('4', { message: 'versionId must be a valid UUID' })
  @IsNotEmpty({ message: 'versionId is required for approval' })
  versionId: string;

  @IsString()
  @IsOptional()
  comments?: string;
}
