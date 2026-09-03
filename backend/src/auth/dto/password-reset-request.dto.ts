import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;
}
