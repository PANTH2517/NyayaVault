import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { RoleName } from '@prisma/client';

export class RegisterRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsEnum(RoleName, { message: 'Invalid role requested' })
  requestedRole: RoleName;
}
