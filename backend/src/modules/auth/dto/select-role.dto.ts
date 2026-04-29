import { Role } from '@prisma/client';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SelectRoleDto {
  @IsIn([Role.STUDENT, Role.TEACHER])
  role: Role;
}
