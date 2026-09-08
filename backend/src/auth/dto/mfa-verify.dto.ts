import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class VerifyMfaLoginDto {
  @IsNotEmpty()
  @IsString()
  mfaChallengeToken: string;

  @IsOptional()
  @IsString()
  totpCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class MfaEnrollInitiateDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;
}

export class MfaEnrollConfirmDto {
  @IsNotEmpty()
  @IsString()
  totpCode: string;
}

export class MfaDisableDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsOptional()
  @IsString()
  totpCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class MfaRegenerateRecoveryCodesDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  totpCode: string;
}
