import { IsEnum, IsNotEmpty } from 'class-validator';
import { RoleName } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(RoleName, { message: 'Role must be ADMIN, INVESTIGATING_OFFICER, SUPERVISOR, or PROSECUTOR' })
  @IsNotEmpty({ message: 'Role is required' })
  role: RoleName;
}
