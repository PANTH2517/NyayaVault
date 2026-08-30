import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SimulateTamperDto {
  @IsString()
  @IsUUID('4', { message: 'versionId must be a valid UUID' })
  @IsNotEmpty({ message: 'versionId is required' })
  versionId: string;
}
