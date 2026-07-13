import { IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserRoleDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN'])
  role: string;
}
