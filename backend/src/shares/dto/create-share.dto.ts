import { IsString, IsNotEmpty, IsUUID, IsNumber, Min, Max } from 'class-validator';

export class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  versionId: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetUserId: string;

  @IsNumber()
  @Min(1)
  @Max(168) // Max 7 days (168 hours)
  expirationHours: number;
}
