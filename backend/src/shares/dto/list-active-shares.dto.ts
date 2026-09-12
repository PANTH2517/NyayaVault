// src/backend/src/shares/dto/list-active-shares.dto.ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Pagination DTO for listing active shares.
 * Uses classic page-number pagination.
 */
export class ListActiveSharesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  /** Page number, starting at 1 */
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  /** Page size (items per page) */
  size?: number = 20;
}
