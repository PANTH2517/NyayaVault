import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;
}
