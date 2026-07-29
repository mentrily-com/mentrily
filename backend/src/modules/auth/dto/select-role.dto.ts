import { Role } from '@prisma/client';
import { IsIn } from 'class-validator';

export class SelectRoleDto {
  @IsIn([Role.STUDENT, Role.TEACHER])
  role: Role;
}
