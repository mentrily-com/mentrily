import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CourseMutationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  courseSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsArray()
  modules?: unknown[];

  @IsOptional()
  @IsArray()
  sections?: unknown[];

  @IsOptional()
  @IsArray()
  tests?: unknown[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsBoolean()
  isProctored?: boolean;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsNumber()
  aiTokensUsed?: number;

  @IsOptional()
  @IsString()
  certificateTemplateId?: string;

  @IsOptional()
  @IsNumber()
  completionThreshold?: number;

  @IsOptional()
  @IsString()
  linkedExamId?: string;

  @IsOptional()
  @IsNumber()
  examPassThreshold?: number;

  @IsOptional()
  @IsNumber()
  examUnlockThreshold?: number;
}
