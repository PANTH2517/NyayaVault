import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsEnum(RoleName, { message: 'Role must be ADMIN, INVESTIGATING_OFFICER, SUPERVISOR, or PROSECUTOR' })
  @IsNotEmpty({ message: 'Role is required' })
  role: RoleName;
}
