import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['USER', 'STUDENT', 'TEACHER', 'ADMIN'])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  id?: string;
}
