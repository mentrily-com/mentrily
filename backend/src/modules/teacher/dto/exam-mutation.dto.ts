import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamMutationDto {
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
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  testCode?: string;

  @IsOptional()
  @IsArray()
  sections?: unknown[];

  @IsOptional()
  @IsArray()
  questions?: unknown[];

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalMarks?: number;

  @IsOptional()
  @IsString()
  testCodeType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rotationInterval?: number;

  @IsOptional()
  @IsString()
  inviteToken?: string;

  @IsOptional()
  @IsString()
  allowedIPs?: string;

  @IsOptional()
  @IsString()
  examMode?: string;

  @IsOptional()
  @IsBoolean()
  aiProctoring?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tabSwitchLimit?: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  aiTokensUsed?: number;

  @IsOptional()
  @IsString()
  linkedCourseId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  passingPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  attemptBufferMins?: number;
}
