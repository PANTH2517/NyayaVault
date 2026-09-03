import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'isActive must be a boolean value' })
  @IsNotEmpty({ message: 'isActive status is required' })
  isActive: boolean;
}
