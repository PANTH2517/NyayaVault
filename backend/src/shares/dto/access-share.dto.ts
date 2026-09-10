import { IsString, IsNotEmpty, Length } from 'class-validator';

export class AccessShareDto {
  @IsString()
  @IsNotEmpty()
  @Length(64, 64) // 32 bytes hex encoded = 64 hex chars
  token: string;
}
