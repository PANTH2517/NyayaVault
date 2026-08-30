import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignUserDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID is required for case assignment' })
  userId: string;

  @IsString()
  @IsOptional()
  roleInCase?: string;
}
