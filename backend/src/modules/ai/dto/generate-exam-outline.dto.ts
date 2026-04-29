import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class SectionConfigDto {
  @IsInt()
  @Min(1)
  @Max(100)
  questionsCount: number;

  @IsArray()
  @IsString({ each: true })
  allowedTypes: string[];

  @IsOptional()
  @IsString()
  difficulty?: string;
}

export class GenerateExamOutlineDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numSections?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionConfigDto)
  sectionConfigs?: SectionConfigDto[];

  @IsOptional()
  @IsString()
  courseSummary?: string;
}
