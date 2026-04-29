import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExamDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsArray()
  sections?: unknown[];
}
