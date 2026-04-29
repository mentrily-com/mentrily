import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateCourseOutlineDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  numSections?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  questionsPerSection?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTypes?: string[];
}
